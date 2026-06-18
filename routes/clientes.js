const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;

const autenticar = require('../middlewares/authJWT');
const verificarAdmin  = require('../middlewares/verificarAdmin');


// =========================
// PERFIL DO CLIENTE LOGADO
// =========================

// Ver perfil do cliente logado
router.get('/perfil', autenticar, (req, res) => {
  const id = req.usuario.id;

  db.query(
    'SELECT id_cliente, nome, email, telefone, endereco, criado_em FROM clientes WHERE id_cliente = ?',
    [id],
    (err, results) => {
      if (err) {
        return res.status(500).json({ erro: err });
      }

      if (results.length === 0) {
        return res.status(404).json({ erro: 'Cliente não encontrado' });
      }

      res.json(results[0]);
    }
  );
});

// Editar perfil do cliente logado
router.put('/perfil', autenticar, (req, res) => {
  const id = req.usuario.id;
  const { nome, email, telefone, endereco } = req.body;

  const sql = `
    UPDATE clientes
    SET nome = ?, email = ?, telefone = ?, endereco = ?
    WHERE id_cliente = ?
  `;

  db.query(sql, [nome, email, telefone, endereco, id], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ erro: 'Email já está em uso' });
      }

      return res.status(500).json({ erro: err });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado' });
    }

    res.json({ mensagem: 'Perfil atualizado com sucesso' });
  });
});

// Alterar senha do cliente logado
router.put('/perfil/senha', autenticar, async (req, res) => {
  const id = req.usuario.id;
  const { senhaAtual, novaSenha } = req.body;

  if (!senhaAtual || !novaSenha) {
    return res.status(400).json({ erro: 'Campos obrigatórios' });
  }

  try {
    db.query(
      'SELECT senha_hash FROM clientes WHERE id_cliente = ?',
      [id],
      async (err, results) => {
        if (err) {
          return res.status(500).json({ erro: err });
        }

        if (results.length === 0) {
          return res.status(404).json({ erro: 'Cliente não encontrado' });
        }

        const senhaCorreta = await bcrypt.compare(
          senhaAtual,
          results[0].senha_hash
        );

        if (!senhaCorreta) {
          return res.status(401).json({ erro: 'Senha atual incorreta' });
        }

        const novaHash = await bcrypt.hash(novaSenha, 10);

        db.query(
          'UPDATE clientes SET senha_hash = ? WHERE id_cliente = ?',
          [novaHash, id],
          (err) => {
            if (err) {
              return res.status(500).json({ erro: err });
            }

            res.json({ mensagem: 'Senha atualizada com sucesso' });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ erro: error });
  }
});

// Deletar a própria conta
router.delete('/perfil', autenticar, (req, res) => {
  const id = req.usuario.id;

  db.query(
    'DELETE FROM clientes WHERE id_cliente = ?',
    [id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ erro: err });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ erro: 'Cliente não encontrado' });
      }

      res.json({ mensagem: 'Conta deletada com sucesso' });
    }
  );
});


// =========================
// ROTAS PÚBLICAS
// =========================

// Cadastro de cliente
router.post('/', async (req, res) => {
  const { nome, email, senha, telefone, endereco } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
  }

  try {
    const senha_hash = await bcrypt.hash(senha, 10);

    const sql = `
      INSERT INTO clientes (nome, email, senha_hash, telefone, endereco, role)
      VALUES (?, ?, ?, ?, ?,'cliente');
    `;

    db.query(
      sql,
      [nome, email, senha_hash, telefone || null, endereco || null],
      (err, result) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ erro: 'Email já cadastrado' });
          }

          return res.status(500).json({ erro: err });
        }

        res.status(201).json({
          mensagem: 'Cliente criado com sucesso',
          id: result.insertId
        });
      }
    );
  } catch (error) {
    res.status(500).json({ erro: error });
  }
});

// Login do cliente
router.post('/login', (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
  }

  db.query(
    'SELECT * FROM clientes WHERE email = ?',
    [email],
    async (err, results) => {
      if (err) {
        return res.status(500).json({ erro: err });
      }

      if (results.length === 0) {
        return res.status(401).json({ erro: 'Credenciais inválidas' });
      }

      const cliente = results[0];

      const senhaValida = await bcrypt.compare(senha, cliente.senha_hash);

      if (!senhaValida) {
        return res.status(401).json({ erro: 'Credenciais inválidas' });
      }

      const token = jwt.sign(
        { id: cliente.id_cliente,
          role: cliente.role
         },
        SECRET,
        { expiresIn: '1h' }
      );

      res.json({
        mensagem: 'Login realizado com sucesso',
        token,
        cliente: {
          id: cliente.id_cliente,
          nome: cliente.nome,
          email: cliente.email,
          role: cliente.role
        }
      });
    }
  );
});


// =========================
// ROTAS ADMIN
// =========================

// Listar todos os clientes
router.get('/', autenticar, verificarAdmin, (req, res) => {
  db.query(
    'SELECT id_cliente, nome, email, telefone, endereco, criado_em, role FROM clientes',
    (err, results) => {
      if (err) {
        return res.status(500).json({ erro: err });
      }

      res.json(results);
    }
  );
});

// Buscar cliente por ID
router.get('/:id', autenticar, verificarAdmin, (req, res) => {
  const { id } = req.params;

  db.query(
    'SELECT id_cliente, nome, email, telefone, endereco, criado_em FROM clientes WHERE id_cliente = ?',
    [id],
    (err, results) => {
      if (err) {
        return res.status(500).json({ erro: err });
      }

      if (results.length === 0) {
        return res.status(404).json({ erro: 'Cliente não encontrado' });
      }

      res.json(results[0]);
    }
  );
});

// Editar cliente por ID
router.put('/:id', autenticar, verificarAdmin, (req, res) => {
  const { id } = req.params;
  const { nome, email, telefone, endereco } = req.body;

  const sql = `
    UPDATE clientes
    SET nome = ?, email = ?, telefone = ?, endereco = ?
    WHERE id_cliente = ?
  `;

  db.query(sql, [nome, email, telefone, endereco, id], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ erro: 'Email já está em uso' });
      }

      return res.status(500).json({ erro: err });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado' });
    }

    res.json({ mensagem: 'Cliente atualizado com sucesso' });
  });
});

// Alterar senha de cliente por ID (admin)
router.put('/:id/senha', autenticar, verificarAdmin, async (req, res) => {
  const { id } = req.params;
  const { novaSenha } = req.body;

  if (!novaSenha) {
    return res.status(400).json({ erro: 'Nova senha é obrigatória' });
  }

  try {
    const novaHash = await bcrypt.hash(novaSenha, 10);

    db.query(
      'UPDATE clientes SET senha_hash = ? WHERE id_cliente = ?',
      [novaHash, id],
      (err, result) => {
        if (err) {
          return res.status(500).json({ erro: err });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ erro: 'Cliente não encontrado' });
        }

        res.json({ mensagem: 'Senha do cliente atualizada com sucesso' });
      }
    );
  } catch (error) {
    res.status(500).json({ erro: error });
  }
});

// Deletar cliente por ID
router.delete('/:id', autenticar, verificarAdmin, (req, res) => {
  const { id } = req.params;

  db.query(
    'DELETE FROM clientes WHERE id_cliente = ?',
    [id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ erro: err });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ erro: 'Cliente não encontrado' });
      }

      res.json({ mensagem: 'Cliente deletado com sucesso' });
    }
  );
});

module.exports = router;