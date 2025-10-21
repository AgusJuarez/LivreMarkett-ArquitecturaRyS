const express = require("express");
const axios = require("axios");
const app = express();
const port = 6000;
app.use(express.json());

let webBD = [];

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

comprar("producto1");
comprar("producto2");
comprar("producto3");
comprar("producto4");
comprar("producto5");

async function comprar(producto) {
  console.log("Comprar producto: ", producto);
  await axios.post("http://compras:6001/comprar", {
    producto: producto,
  });
}

app.post("/solicitarFormaEnvio", (req, res) => {
  const nuevaCompra = req.body.compra;
  console.log(nuevaCompra);
  let compra = { ...nuevaCompra };
  try {
    if (!(compra.compraId in webBD)) {
      webBD[compra.compraId] = nuevaCompra;
    }
    console.log(
      "Introduciendo forma de envio del producto: ",
      compra.producto,
      " ID: ",
      compra.compraId
    );
    compra.formaDeEntrega = Math.random() > 0.5 ? "retira" : "correo";
    compra.estado = "forma_envio_enviada";
    compra.estados.push("forma_envio_enviada");

    actualizarBaseDatos(compra);
    compra = findCompra(compra.compraId);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
  res.status(200).send(compra);
});

app.post("/cqrsRequest", (req, res) => {
  const compra = req.body.compras.compras;
  console.log(req.body.compras);
  try {
    let nuevaCompra = { ...compra };
    console.log(nuevaCompra);
    console.log(
      "El Servicio de CQRS pidio informacion de la compra: ",
      nuevaCompra.compraId
    );
    let resultCompra = findCompra(nuevaCompra.compraId);
    if (resultCompra == null) {
      resultCompra = {
        compraId: nuevaCompra.compraId,
        estado: "No existe compra",
      };
    }
    let result = ["WEB", resultCompra];
    compra.listaCompras.push(result);
    res.status(200).send(compra);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
});

app.post("/solicitarFormaPago", (req, res) => {
  const nuevaCompra = req.body.compra;
  console.log(nuevaCompra);
  let compra = { ...nuevaCompra };
  try {
    if (!(compra.compraId in webBD)) {
      webBD[compra.compraId] = nuevaCompra;
    }
    console.log(
      "Introduciendo forma de pago del producto: ",
      compra.producto,
      " ID: ",
      compra.compraId
    );
    compra.estado = "forma_pago_enviado";
    compra.estados.push("forma_pago_enviado");
    compra.medioPago = Math.random() > 0.5 ? "efectivo" : "tarjeta";

    actualizarBaseDatos(compra);
    compra = findCompra(compra.compraId);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
  res.status(200).send(compra);
});

app.post("/cancelarCompra", (req, res) => {
  const nuevaCompra = req.body.compra;
  try {
    let compra = { ...nuevaCompra };
    actualizarBaseDatos(compra);
    compra = findCompra(compra.compraId);
    console.log("--------------------------------------------------");
    console.log(
      "Informando sobre compra cancelada del producto: ",
      compra.producto,
      " ID: ",
      compra.compraId
    );
    console.log(compra);
    console.log("--------------------------------------------------");
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
  res.status(200).send(nuevaCompra);
});

app.post("/compraFinalizada", (req, res) => {
  const nuevaCompra = req.body.compra;
  let compra = { ...nuevaCompra };
  try {
    actualizarBaseDatos(compra);
    compra = findCompra(compra.compraId);
    console.log("--------------------------------------------------");
    console.log(
      "Compra confirmada del producto: ",
      compra.producto,
      " ID: ",
      compra.compraId
    );
    console.log(compra);
    console.log("--------------------------------------------------");
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
  res.status(200).send(compra);
});

function findCompra(nuevaCompraID) {
  return webBD[nuevaCompraID];
}

async function actualizarBaseDatos(nuevaCompra) {
  let compraExistente = webBD[nuevaCompra.compraId];
  if (compraExistente) {
    let estadosCombinados = [
      ...compraExistente.estados,
      ...nuevaCompra.estados,
    ];
    estadosCombinados = Array.from(new Set(estadosCombinados));
    webBD[compraExistente.compraId] = {
      ...compraExistente,
      ...nuevaCompra,
      estados: estadosCombinados,
    };
  }
}
