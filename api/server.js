require('dotenv').config();
const express = require('express');
const cors = require('cors');
const PORT = process.env.PORT || 3000;
const app = express();

app.use(cors());
app.use(express.json());


const produtosRoutes = require('../routes/produtos');
const clientesRoutes = require('../routes/clientes');
const pedidosRoutes = require('../routes/pedidos');
const carrinhoRoutes = require('../routes/carrinho');

app.use('/carrinho', carrinhoRoutes);
app.use('/pedidos', pedidosRoutes);
app.use('/produtos', produtosRoutes);
app.use('/clientes', clientesRoutes);

app.get('/', (req, res) => {
  res.send('API funcionando 🚀');
});

app.listen(PORT, () => {
  console.log(`Server rodando na porta ${PORT}`);
});

