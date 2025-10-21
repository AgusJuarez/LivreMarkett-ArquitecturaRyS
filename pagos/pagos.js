#!/usr/bin/env node
//**Pagos**: Servicio de pago que autoriza o rechaza transacciones.

const axios = require("axios");
const express = require("express");
const app = express();
const port = 9000;
app.use(express.json());
let pagosBD = [];

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

app.post("/pagarCompra", (req, res) => {
  const compra = req.body.compra;
  let nuevaCompra = { ...compra };
  console.log(nuevaCompra);
  try {
    pagosBD[nuevaCompra.compraId] = nuevaCompra;
    console.log("Pagando compra: " + nuevaCompra.compraId);
    nuevaCompra.estado = "pagando";
    nuevaCompra.estados.push("pagando");
    nuevaCompra.resultadoPago =
      Math.random() > 0.3 ? "autorizado" : "rechazado";
    actualizarBaseDatos(nuevaCompra);
    nuevaCompra = findCompra(nuevaCompra.compraId);
    if (nuevaCompra.resultadoPago === "rechazado") {
      console.log(
        "Pago rechazado del producto: ",
        nuevaCompra.producto,
        " ID: ",
        nuevaCompra.compraId
      );
      nuevaCompra.estado = "compra_cancelada";
      nuevaCompra.estados.push("compra_cancelada");
      nuevaCompra.motivo = "Pago rechazado";
      actualizarBaseDatos(nuevaCompra);
      nuevaCompra = findCompra(nuevaCompra.compraId);
      console.log(
        "Compra rechazado del producto: ",
        nuevaCompra.producto,
        " ID: ",
        nuevaCompra.compraId
      );
      try {
        res.status(200).send(nuevaCompra);
      } catch (error) {
        console.error(
          "Error cancelar la reserva en Pago Rechazado:",
          error.message
        );
      }
    } else {
      try {
        nuevaCompra.estados.push("producto_pagado");
        nuevaCompra.estado = "producto_pagado";
        actualizarBaseDatos(nuevaCompra);
        nuevaCompra = findCompra(nuevaCompra.compraId);
        setTimeout(() => {
          res.status(200).send(nuevaCompra);
        }, Math.random() * 1e3);
      } catch (error) {
        console.error("Error al enviar el producto:", error.message);
      }
    }
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
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
    let result = ["PAGOS", resultCompra];
    compra.listaCompras.push(result);
    res.status(200).send(compra);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
});

app.post("/cancelarCompra", (req, res) => {
  const compra = req.body.compra;
  let nuevaCompra = { ...compra };
  try {
    nuevaCompra.estado = "compra_cancelada";
    nuevaCompra.estados.push("compra_cancelada");
    actualizarBaseDatos(nuevaCompra);
    console.log("Cancelacion de pago de la compra: ", nuevaCompra.compraId);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
  res.status(200).send(nuevaCompra);
});

function findCompra(nuevaCompraID) {
  return pagosBD[nuevaCompraID];
}

async function actualizarBaseDatos(nuevaCompra) {
  let compraExistente = pagosBD[nuevaCompra.compraId];
  if (compraExistente) {
    let estadosCombinados = [
      ...compraExistente.estados,
      ...nuevaCompra.estados,
    ];
    estadosCombinados = Array.from(new Set(estadosCombinados));
    pagosBD[compraExistente.compraId] = {
      ...compraExistente,
      ...nuevaCompra,
      estados: estadosCombinados,
    };
  }
}
