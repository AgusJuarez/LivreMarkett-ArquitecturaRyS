#!/usr/bin/env node
const axios = require("axios");
const express = require("express");
const app = express();
const port = 6001;
app.use(express.json());

const https = require("https");
const fs = require("fs");
const ca = fs.readFileSync("/home/compras/wso2carbon.cer");
let compraId = 0;
let comprasBD = [];

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

app.post("/cqrsRequest", (req, res) => {
  const compra = req.body.compras;
  try {
    let nuevaCompra = { ...compra };
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
    let result = ["COMPRAS", resultCompra];
    compra.listaCompras.push(result);
    res.status(200).send(compra);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
});

app.post("/comprar", (req, res) => {
  res.status(200).send("ok");
  compraId++;
  let nuevaCompra = {
    compraId: compraId,
    producto: req.body.producto,
    estado: "producto_seleccionado",
    estados: ["producto_seleccionado"],
  };
  try {
    comprasBD[compraId] = nuevaCompra;
    console.log(
      "Arranca ",
      nuevaCompra.producto,
      "time: ",
      new Date().toISOString()
    );
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }

  axios
    .post("http://wso2ei:8280/services/compras", { compra: nuevaCompra })
    .then((response) => {
      console.log("Respuesta:", response.data);
    })
    .catch((error) => {
      console.error("Error:", error.message);
    });
  /*
  const agent = new https.Agent({
    ca: ca,
    rejectUnauthorized: true,
  });

  axios
    .post(
      "https://wso2ei:8243/services/compras",
      { compra: nuevaCompra },
      { httpsAgent: agent }
    )
    .then((response) => {
      console.log("Respuesta:", response.data);
    })
    .catch((error) => {
      console.error("Error:", error.message);
    });*/
});

app.post("/cancelarCompra", (req, res) => {
  const nuevaCompra = req.body.compra;
  res.status(200).send(nuevaCompra);
  let compra = nuevaCompra;
  try {
    actualizarBaseDatos(compra);
    compra = findCompra(compra.compraId);
    console.log("--------------------------------------------------");
    console.log(
      "Informando sobre COMPRA CANCELADA del producto: ",
      compra.producto,
      " ID: ",
      compra.compraId
    );
    console.log(compra);
    console.log("--------------------------------------------------");
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
});

app.post("/finalizarCompra", (req, res) => {
  const compra = req.body.compra;
  res.status(200).send(compra);
  let nuevaCompra = { ...compra };
  try {
    console.log(
      "Confirmar compra del  producto: ",
      nuevaCompra.producto,
      " ID: ",
      nuevaCompra.compraId
    );
    finalizarCompra(nuevaCompra);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
});

function finalizarCompra(nuevaCompra) {
  nuevaCompra.estado = "compra_finalizada";
  nuevaCompra.estados.push("compra_finalizada");
  actualizarBaseDatos(nuevaCompra);
  nuevaCompra = findCompra(nuevaCompra.compraId);
  console.log(
    "**********************************************************************"
  );
  console.log("Compra finalizada exitosamente:", nuevaCompra);
  console.log(
    "**********************************************************************"
  );
  try {
    setTimeout(() => {
      enviar("cola_web", nuevaCompra, "-");
      enviar("cola_envios", nuevaCompra, "-");
    }, Math.random() * 1e3);
  } catch (error) {
    console.error("Error al confirmar compra a Web:", error.message);
  }
}

function findCompra(nuevaCompraID) {
  return comprasBD[nuevaCompraID];
}

async function actualizarBaseDatos(nuevaCompra) {
  let compraExistente = comprasBD[nuevaCompra.compraId];
  if (compraExistente) {
    let estadosCombinados = [
      ...compraExistente.estados,
      ...nuevaCompra.estados,
    ];
    estadosCombinados = Array.from(new Set(estadosCombinados));
    comprasBD[compraExistente.compraId] = {
      ...compraExistente,
      ...nuevaCompra,
      estados: estadosCombinados,
    };
  }
}
