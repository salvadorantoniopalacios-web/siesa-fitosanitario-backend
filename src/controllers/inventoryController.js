import pool from "../config/db.js";

const obtenerCompanyId = (req) => {
  return req.usuario?.company_id || null;
};

const normalizarNumero = (valor) => {
  if (valor === "" || valor === null || valor === undefined) return null;

  const numero = Number(valor);

  return Number.isNaN(numero) ? null : numero;
};

export const getInventoryProducts = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM inventory_products
      WHERE company_id = $1
      ORDER BY id DESC
      `,
      [companyId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET INVENTORY:", error);

    res.status(500).json({
      mensaje: "Error obteniendo inventario",
      error: error.message,
    });
  }
};

export const createInventoryProduct = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const {
      nombre,
      ingrediente_activo,
      proveedor,
      existencia,
      unidad,
      costo_unitario,
      fecha_vencimiento,
      estado,
    } = req.body;

    if (!nombre || nombre.trim() === "") {
      return res.status(400).json({
        mensaje: "El nombre del producto es obligatorio.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO inventory_products (
        company_id,
        nombre,
        ingrediente_activo,
        proveedor,
        existencia,
        unidad,
        costo_unitario,
        fecha_vencimiento,
        estado
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
      `,
      [
        companyId,
        nombre.trim(),
        ingrediente_activo || null,
        proveedor || null,
        normalizarNumero(existencia) || 0,
        unidad || "L",
        normalizarNumero(costo_unitario),
        fecha_vencimiento || null,
        estado || "Activo",
      ]
    );

    res.status(201).json({
      mensaje: "Producto creado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR CREATE INVENTORY:", error);

    res.status(500).json({
      mensaje: "Error creando producto de inventario",
      error: error.message,
    });
  }
};

export const updateInventoryProduct = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const {
      nombre,
      ingrediente_activo,
      proveedor,
      existencia,
      unidad,
      costo_unitario,
      fecha_vencimiento,
      estado,
    } = req.body;

    if (!nombre || nombre.trim() === "") {
      return res.status(400).json({
        mensaje: "El nombre del producto es obligatorio.",
      });
    }

    const result = await pool.query(
      `
      UPDATE inventory_products
      SET
        nombre = $1,
        ingrediente_activo = $2,
        proveedor = $3,
        existencia = $4,
        unidad = $5,
        costo_unitario = $6,
        fecha_vencimiento = $7,
        estado = $8
      WHERE id = $9
      AND company_id = $10
      RETURNING *
      `,
      [
        nombre.trim(),
        ingrediente_activo || null,
        proveedor || null,
        normalizarNumero(existencia) || 0,
        unidad || "L",
        normalizarNumero(costo_unitario),
        fecha_vencimiento || null,
        estado || "Activo",
        id,
        companyId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Producto no encontrado para esta empresa.",
      });
    }

    res.json({
      mensaje: "Producto actualizado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR UPDATE INVENTORY:", error);

    res.status(500).json({
      mensaje: "Error actualizando producto de inventario",
      error: error.message,
    });
  }
};

export const deleteInventoryProduct = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM inventory_products
      WHERE id = $1
      AND company_id = $2
      RETURNING *
      `,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Producto no encontrado para esta empresa.",
      });
    }

    res.json({
      mensaje: "Producto eliminado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR DELETE INVENTORY:", error);

    res.status(500).json({
      mensaje: "Error eliminando producto de inventario",
      error: error.message,
    });
  }
};