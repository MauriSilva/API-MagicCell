// const ADMIN_TOKEN = process.env.ADMIN_KEY;

// function verificarAdmin(req, res, next) {
//   const token = req.headers['x-admin-token'];

//   if (token !== ADMIN_TOKEN) {
//     return res.status(403).json({ erro: 'Acesso negado' });
//   }

//   next();
// }

// module.exports = { verificarAdmin };