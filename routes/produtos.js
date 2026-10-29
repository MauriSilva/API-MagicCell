const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const autenticar = require('../middlewares/authJWT');
const verificarAdmin = require('../middlewares/verificarAdmin');

// GET /produtos

/* GET /produtos?page=1&limit=10 */
router.get('/', (req, res) => {
  let page = Number.parseInt(req.query.page, 10) || 1;
  let limit = Number.parseInt(req.query.limit, 10) || 10;

  // Validação dos parâmetros
  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({
      erro: 'A página deve ser um número inteiro maior que zero.'
    });
  }

  if (!Number.isInteger(limit) || limit < 1) {
    return res.status(400).json({
      erro: 'O limite deve ser um número inteiro maior que zero.'
    });
  }

  // Evita que uma requisição tente carregar produtos demais
  limit = Math.min(limit, 50);

  const offset = (page - 1) * limit;

  // Primeiro, descobrimos quantos produtos existem
  db.query(
    'SELECT COUNT(*) AS total FROM produtos',
    (err, countResults) => {
      if (err) {
        return res.status(500).json({
          erro: 'Erro ao contar os produtos.'
        });
      }

      const totalProdutos = countResults[0].total;
      const totalPaginas = Math.ceil(totalProdutos / limit);

      // Não permite acessar páginas inexistentes
      if (totalPaginas > 0 && page > totalPaginas) {
        return res.status(404).json({
          erro: 'Página não encontrada.',
          totalPaginas
        });
      }

      // Busca somente os produtos da página solicitada
      const sql = `
        SELECT *
        FROM produtos
        ORDER BY id_produto DESC
        LIMIT ? OFFSET ?
      `;

      db.query(sql, [limit, offset], (err, produtos) => {
        if (err) {
          return res.status(500).json({
            erro: 'Erro ao buscar os produtos.'
          });
        }

        return res.json({
          data: produtos,
          pagination: {
            currentPage: page,
            perPage: limit,
            totalProducts: totalProdutos,
            totalPages: totalPaginas
          }
        });
      });
    }
  );
});


//GET produto:id
router.get('/:id', (req, res) => {
    const { id } = req.params;

    const sql = `
        SELECT *
        FROM produtos
        WHERE id_produto = ?
    `;

    db.query(sql, [id], (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Erro ao buscar produto'
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Produto encontrado',
            data: results[0]
        });
    });
});

// POST /produtos
router.post('/', autenticar, verificarAdmin, (req, res) => {
  const { nome, descricao, preco, estoque, imagem_url, tipo } = req.body;

  // validação básica
  if (!nome || !preco) {
    return res.status(400).json({ erro: 'Nome e preço são obrigatórios' });
  }

  const sql = `
    INSERT INTO produtos (nome, descricao, preco, estoque, imagem_url, tipo)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [nome, descricao || null, preco, estoque || 0, imagem_url || null, tipo || 'outros'],
    (err, result) => {
      if (err) {
        return res.status(500).json({ erro: err });
      }

      res.status(201).json({
        mensagem: 'Produto criado com sucesso',
        id: result.insertId
      });
    }
  );
});

//PUT /Produtos
router.put('/:id', autenticar, verificarAdmin, (req, res) => {
  const { id } = req.params;
  const { nome, descricao, preco, estoque, imagem_url } = req.body;

  const sql = `
    UPDATE produtos
    SET nome = ?, descricao = ?, preco = ?, estoque = ?, imagem_url = ?
    WHERE id_produto = ?
  `;

  db.query(
    sql,
    [
      nome,
      descricao,
      preco,
      estoque,
      imagem_url,
      id
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json({ erro: err });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ erro: 'Produto não encontrado' });
      }

      res.json({ mensagem: 'Produto atualizado com sucesso' });
    }
  );
});

// DELETE /produtos
router.delete('/:id', autenticar, verificarAdmin, (req, res) => {
  const { id } = req.params;

  const sql = 'DELETE FROM produtos WHERE id_produto = ?';

  db.query(sql, [id], (err, result) => {
    if (err) {
      return res.status(500).json({ erro: err });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    res.json({ mensagem: 'Produto deletado com sucesso' });
  });
});

module.exports = router;