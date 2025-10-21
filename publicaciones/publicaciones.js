#!/usr/bin/env node
//**Publicaciones**: Administra los productos o servicios publicados y gestiona la reserva de los mismos durante el proceso de compra.

const axios = require("axios");
const express = require("express");
const app = express();
const port = 10000;
app.use(express.json());
let publicacionesBD = [];
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
    let result = ["PUBLICACIONES", resultCompra];
    compra.listaCompras.push(result);
    res.status(200).send(compra);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
});

app.post("/reservarProducto", (req, res) => {
  let nuevaCompra = req.body.compra;
  try {
    publicacionesBD[nuevaCompra.compraId] = nuevaCompra;
    console.log("Producto reservado de compra: " + nuevaCompra.compraId);
    nuevaCompra.estado = "producto_reservado";
    nuevaCompra.estados.push("producto_reservado");
    nuevaCompra.reserva = true;
    actualizarBaseDatos(nuevaCompra);
    nuevaCompra = findCompra(nuevaCompra.compraId);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
  res.status(200).send(nuevaCompra);
});

app.post("/productoPagado", (req, res) => {
  let nuevaCompra = req.body.compra;
  try {
    nuevaCompra = compra;
    nuevaCompra.estado = "reserva_confirmada";
    nuevaCompra.estados.push("reserva_confirmada");
    console.log("Reserva confirmada:", nuevaCompra);
    actualizarBaseDatos(nuevaCompra);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
  res.status(200).send(nuevaCompra);
});

app.post("/cancelarReserva", (req, res) => {
  const nuevaCompra = req.body.compra;
  try {
    cancelarReserva(nuevaCompra);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
  res.status(200).send(nuevaCompra);
});

function cancelarReserva(compra) {
  let nuevaCompra = {};
  nuevaCompra = compra;
  nuevaCompra.reserva = false;
  nuevaCompra.estados.push("reserva_cancelada");
  actualizarBaseDatos(nuevaCompra);
  nuevaCompra = findCompra(nuevaCompra.compraId);
  console.log(
    "Cancelar reserva del producto de compra: " + nuevaCompra.compraId,
    " MOTIVO: ",
    nuevaCompra.motivo
  );
}

function findCompra(nuevaCompraID) {
  return publicacionesBD[nuevaCompraID];
}

async function actualizarBaseDatos(nuevaCompra) {
  let compraExistente = publicacionesBD[nuevaCompra.compraId];
  if (compraExistente) {
    let estadosCombinados = [
      ...compraExistente.estados,
      ...nuevaCompra.estados,
    ];
    estadosCombinados = Array.from(new Set(estadosCombinados));
    publicacionesBD[compraExistente.compraId] = {
      ...compraExistente,
      ...nuevaCompra,
      estados: estadosCombinados,
    };
  }
}
