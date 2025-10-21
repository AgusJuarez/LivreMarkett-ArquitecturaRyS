#!/usr/bin/env node

//**Infracciones**: Evalúa el cumplimiento de las políticas de publicación y detecta posibles infracciones por parte de compradores o vendedores.

const axios = require("axios");
const express = require("express");
const app = express();
const port = 8000;
app.use(express.json());
let infraccionesBD = [];

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

app.post("/infracciones", (req, res) => {
  const nuevaCompra = req.body;
  try {
    pagosEmitter.emit(nuevaCompra.estado, nuevaCompra);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
  res.status(200).send("ok");
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
    let result = ["INFRACCIONES", resultCompra];
    compra.listaCompras.push(result);
    res.status(200).send(compra);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
});

app.post("/detectarInfracciones", (req, res) => {
  const compra = req.body.compra;
  console.log(compra);
  let nuevaCompra = { ...compra };
  try {
    infraccionesBD[compra.compraId] = nuevaCompra;
    console.log(
      "Solicitando DETECCION de INFRACCION del producto: ",
      nuevaCompra.producto,
      " ID: ",
      nuevaCompra.compraId,
      " ESTADO: ",
      nuevaCompra.estado
    );
    console.log("Detectando infraciones de compra: " + nuevaCompra.compraId);
    nuevaCompra.estado = "detectando_infracciones";
    nuevaCompra.estados.push("detectando_infracciones");
    nuevaCompra.hasPublicacion = Math.random() > 0.7 ? true : false;
    actualizarBaseDatos(nuevaCompra);
    nuevaCompra = findCompra(nuevaCompra.compraId);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
  res.status(200).send(nuevaCompra);
});

app.post("/compraSincronizada", (req, res) => {
  const compra = req.body.compra;
  let nuevaCompra = {};
  nuevaCompra = compra;
  try {
    nuevaCompra.estados.push("verificando_infraccion");
    actualizarBaseDatos(nuevaCompra);
    nuevaCompra = findCompra(nuevaCompra.compraId);
    console.log(
      "EVALUANDO SI HAY INFRACCION del producto: ",
      nuevaCompra.producto,
      " ID: ",
      nuevaCompra.compraId,
      " ESTADO: ",
      nuevaCompra.estado
    );
    if (nuevaCompra.hasPublicacion) {
      try {
        nuevaCompra.estado = "cancelada_por_infraccion";
        nuevaCompra.estados.push("compra_cancelada");
        nuevaCompra.motivo = "Detectada infracción";
        actualizarBaseDatos(nuevaCompra);
        nuevaCompra = findCompra(nuevaCompra.compraId);
        res.status(200).send(nuevaCompra);
      } catch (error) {
        console.error(
          "Error al informar sobre Infraccion Detectada:",
          error.message
        );
      }
      console.log(
        "Compra " + nuevaCompra.compraId + " cancelada por infracción"
      );
    } else {
      nuevaCompra.estados.push("sin_infracciones");
      nuevaCompra.estado = "sin_infracciones";
      actualizarBaseDatos(nuevaCompra);
      nuevaCompra = findCompra(nuevaCompra.compraId);
      res.status(200).send(nuevaCompra);
    }
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
});

app.post("/cancelarCompra", (req, res) => {
  const compra = req.body.compra;
  let nuevaCompra = { ...compra };
  try {
    nuevaCompra.estado = "compra_cancelado";
    nuevaCompra.estados.push("compra_cancelado");
    actualizarBaseDatos(nuevaCompra);
    console.log(
      "Cancelacion de compra: ",
      nuevaCompra.compraId,
      " por MOTIVO: ",
      nuevaCompra.motivo
    );
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
  res.status(200).send(nuevaCompra);
});

function findCompra(nuevaCompraID) {
  return infraccionesBD[nuevaCompraID];
}

async function actualizarBaseDatos(nuevaCompra) {
  let compraExistente = infraccionesBD[nuevaCompra.compraId];
  if (compraExistente) {
    let estadosCombinados = [
      ...compraExistente.estados,
      ...nuevaCompra.estados,
    ];
    estadosCombinados = Array.from(new Set(estadosCombinados));
    infraccionesBD[compraExistente.compraId] = {
      ...compraExistente,
      ...nuevaCompra,
      estados: estadosCombinados,
    };
  }
}
