const ADMIN_TOKEN = 'segredo123';

function verificarAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];

  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({ erro: 'Acesso negado' });
  }

  next();
}

module.exports = { verificarAdmin };