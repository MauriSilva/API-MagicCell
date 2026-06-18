const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const autenticar = require('../middlewares/authJWT');
const verificarAdmin = require('../middlewares/verificarAdmin');

// GET /produtos
router.get('/', (req, res) => {
  db.query('SELECT * FROM produtos', (err, results) => {
    if (err) {
      return res.status(500).json({ erro: err });
    }
    res.json(results);
  });
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