function verificarAdmin(req, res, next) {

  if (!req.usuario) {

    return res.status(401).json({
      erro: 'Usuário não autenticado'
    });
  }

  if (req.usuario.role !== 'admin') {

    return res.status(403).json({
      erro: 'Acesso negado'
    });
  }

  next();
}

module.exports = verificarAdmin;