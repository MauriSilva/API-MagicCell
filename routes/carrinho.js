const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const autenticar = require('../middlewares/authJWT');


// ADICIONAR PRODUTO AO CARRINHO
router.post('/', autenticar, (req, res) => {
  const id_cliente = req.usuario.id;
  const { id_produto, quantidade } = req.body;

  if (!id_produto || !quantidade || quantidade <= 0) {
    return res.status(400).json({ erro: 'Produto e quantidade são obrigatórios' });
  }

  // Se o produto já estiver no carrinho, soma quantidade
  const sql = `
    INSERT INTO carrinho (id_cliente, id_produto, quantidade)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE quantidade = quantidade + VALUES(quantidade)
  `;

  db.query(sql, [id_cliente, id_produto, quantidade], (err, result) => {
    if (err) return res.status(500).json({ erro: err });

    res.status(201).json({ mensagem: 'Produto adicionado ao carrinho' });
  });
});


// LISTAR CARRINHO DO CLIENTE LOGADO
router.get('/', autenticar, (req, res) => {
  const id_cliente = req.usuario.id;

  const sql = `
    SELECT 
      c.id_item,
      c.id_produto,
      p.nome,
      p.preco,
      p.imagem_url,
      c.quantidade,
      (p.preco * c.quantidade) AS subtotal
    FROM carrinho c
    JOIN produtos p ON c.id_produto = p.id_produto
    WHERE c.id_cliente = ?
  `;

  db.query(sql, [id_cliente], (err, results) => {
    if (err) return res.status(500).json({ erro: err });

    const total = results.reduce((acc, item) => {
      return acc + Number(item.subtotal);
    }, 0);

    res.json({
      itens: results,
      total
    });
  });
});


// ALTERAR QUANTIDADE DO ITEM
router.put('/:id_item', autenticar, (req, res) => {
  const id_cliente = req.usuario.id;
  const { id_item } = req.params;
  const { quantidade } = req.body;

  if (!quantidade || quantidade <= 0) {
    return res.status(400).json({ erro: 'Quantidade inválida' });
  }

  const sql = `
    UPDATE carrinho
    SET quantidade = ?
    WHERE id_item = ? AND id_cliente = ?
  `;

  db.query(sql, [quantidade, id_item, id_cliente], (err, result) => {
    if (err) return res.status(500).json({ erro: err });

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Item não encontrado no carrinho' });
    }

    res.json({ mensagem: 'Quantidade atualizada' });
  });
});


// REMOVER ITEM DO CARRINHO
router.delete('/:id_item', autenticar, (req, res) => {
  const id_cliente = req.usuario.id;
  const { id_item } = req.params;

  db.query(
    'DELETE FROM carrinho WHERE id_item = ? AND id_cliente = ?',
    [id_item, id_cliente],
    (err, result) => {
      if (err) return res.status(500).json({ erro: err });

      if (result.affectedRows === 0) {
        return res.status(404).json({ erro: 'Item não encontrado no carrinho' });
      }

      res.json({ mensagem: 'Item removido do carrinho' });
    }
  );
});


// LIMPAR CARRINHO
router.delete('/', autenticar, (req, res) => {
  const id_cliente = req.usuario.id;

  db.query(
    'DELETE FROM carrinho WHERE id_cliente = ?',
    [id_cliente],
    (err) => {
      if (err) return res.status(500).json({ erro: err });

      res.json({ mensagem: 'Carrinho limpo' });
    }
  );
});

module.exports = router;