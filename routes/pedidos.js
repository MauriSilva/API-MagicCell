const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const autenticar = require('../middlewares/authJWT');
const verificarAdmin  = require('../middlewares/verificarAdmin');


// CRIAR PEDIDO
router.post('/', autenticar, (req, res) => {
  const id_cliente = req.usuario.id;
  const { itens } = req.body;

  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Pedido precisa ter itens' });
  }

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ erro: err });

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        return res.status(500).json({ erro: err });
      }

      const idsProdutos = itens.map(item => item.id_produto);

      connection.query(
        `SELECT id_produto, preco, estoque FROM produtos WHERE id_produto IN (?)`,
        [idsProdutos],
        (err, produtos) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ erro: err });
            });
          }

          let total = 0;
          const pedidoItens = [];

          for (const item of itens) {
            const produto = produtos.find(p => p.id_produto === item.id_produto);

            if (!produto) {
              return connection.rollback(() => {
                connection.release();
                res.status(404).json({ erro: `Produto ${item.id_produto} não encontrado` });
              });
            }

            if (produto.estoque < item.quantidade) {
              return connection.rollback(() => {
                connection.release();
                res.status(400).json({ erro: `Estoque insuficiente para o produto ${item.id_produto}` });
              });
            }

            total += Number(produto.preco) * item.quantidade;

            pedidoItens.push([
              null,
              item.id_produto,
              item.quantidade,
              produto.preco
            ]);
          }

          connection.query(
            'INSERT INTO pedidos (id_cliente, total, status) VALUES (?, ?, ?)',
            [id_cliente, total, 'pendente'],
            (err, result) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ erro: err });
                });
              }

              const id_pedido = result.insertId;

              const itensFormatados = pedidoItens.map(item => [
                id_pedido,
                item[1],
                item[2],
                item[3]
              ]);

              connection.query(
                `INSERT INTO pedido_itens (id_pedido, id_produto, quantidade, preco_unitario)
                 VALUES ?`,
                [itensFormatados],
                (err) => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      res.status(500).json({ erro: err });
                    });
                  }

                  for (const item of itens) {
                    connection.query(
                      'UPDATE produtos SET estoque = estoque - ? WHERE id_produto = ?',
                      [item.quantidade, item.id_produto]
                    );
                  }

                  connection.commit((err) => {
                    if (err) {
                      return connection.rollback(() => {
                        connection.release();
                        res.status(500).json({ erro: err });
                      });
                    }

                    connection.release();

                    res.status(201).json({
                      mensagem: 'Pedido criado com sucesso',
                      id_pedido,
                      total
                    });
                  });
                }
              );
            }
          );
        }
      );
    });
  });
});


// LISTAR PEDIDOS DO CLIENTE LOGADO
router.get('/', autenticar, (req, res) => {
  const id_cliente = req.usuario.id;

  db.query(
    'SELECT * FROM pedidos WHERE id_cliente = ? ORDER BY criado_em DESC',
    [id_cliente],
    (err, results) => {
      if (err) return res.status(500).json({ erro: err });

      res.json(results);
    }
  );
});


// VER DETALHES DE UM PEDIDO DO CLIENTE
router.get('/:id', autenticar, (req, res) => {
  const id_cliente = req.usuario.id;
  const { id } = req.params;

  const sql = `
    SELECT 
      p.id_pedido,
      p.total,
      p.status,
      p.criado_em,
      pi.id_produto,
      pr.nome,
      pi.quantidade,
      pi.preco_unitario
    FROM pedidos p
    JOIN pedido_itens pi ON p.id_pedido = pi.id_pedido
    JOIN produtos pr ON pi.id_produto = pr.id_produto
    WHERE p.id_pedido = ? AND p.id_cliente = ?
  `;

  db.query(sql, [id, id_cliente], (err, results) => {
    if (err) return res.status(500).json({ erro: err });

    if (results.length === 0) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    res.json(results);
  });
});


// ADMIN - LISTAR TODOS OS PEDIDOS
router.get('/admin/todos', autenticar, verificarAdmin, (req, res) => {
  db.query(
    `SELECT p.*, c.nome, c.email 
     FROM pedidos p
     JOIN clientes c ON p.id_cliente = c.id_cliente
     ORDER BY p.criado_em DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ erro: err });

      res.json(results);
    }
  );
});


// ADMIN - ATUALIZAR STATUS
router.put('/admin/:id/status', autenticar, verificarAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const statusPermitidos = ['pendente', 'pago', 'enviado', 'entregue', 'cancelado'];

  if (!statusPermitidos.includes(status)) {
    return res.status(400).json({ erro: 'Status inválido' });
  }

  db.query(
    'UPDATE pedidos SET status = ? WHERE id_pedido = ?',
    [status, id],
    (err, result) => {
      if (err) return res.status(500).json({ erro: err });

      if (result.affectedRows === 0) {
        return res.status(404).json({ erro: 'Pedido não encontrado' });
      }

      res.json({ mensagem: 'Status atualizado com sucesso' });
    }
  );
});

//FINALIZAR CARRINHO
router.post('/finalizar-carrinho', autenticar, async (req, res) => {
  const id_cliente = req.usuario.id;

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [itensCarrinho] = await connection.query(
      `
      SELECT 
        c.id_produto,
        c.quantidade,
        p.preco,
        p.estoque
      FROM carrinho c
      JOIN produtos p ON c.id_produto = p.id_produto
      WHERE c.id_cliente = ?
      `,
      [id_cliente]
    );

    if (itensCarrinho.length === 0) {
      throw new Error('Carrinho vazio');
    }

    let total = 0;

    for (const item of itensCarrinho) {
      if (item.estoque < item.quantidade) {
        throw new Error(`Estoque insuficiente para o produto ${item.id_produto}`);
      }

      total += Number(item.preco) * item.quantidade;
    }

    const [pedidoResult] = await connection.query(
      'INSERT INTO pedidos (id_cliente, total, status) VALUES (?, ?, ?)',
      [id_cliente, total, 'pendente']
    );

    const id_pedido = pedidoResult.insertId;

    for (const item of itensCarrinho) {
      await connection.query(
        `
        INSERT INTO pedido_itens
        (id_pedido, id_produto, quantidade, preco_unitario)
        VALUES (?, ?, ?, ?)
        `,
        [id_pedido, item.id_produto, item.quantidade, item.preco]
      );

      await connection.query(
        'UPDATE produtos SET estoque = estoque - ? WHERE id_produto = ?',
        [item.quantidade, item.id_produto]
      );
    }

    await connection.query(
      'DELETE FROM carrinho WHERE id_cliente = ?',
      [id_cliente]
    );

    await connection.commit();

    res.status(201).json({
      mensagem: 'Pedido criado a partir do carrinho',
      id_pedido,
      total
    });

  } catch (error) {
    await connection.rollback();

    res.status(400).json({
      erro: error.message || error
    });

  } finally {
    connection.release();
  }
});

module.exports = router;