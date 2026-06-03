import pool from "../config/db.js";

const obtenerCompanyId = (req) => {
  return req.usuario?.company_id || null;
};

const normalizarNumero = (valor) => {
  if (valor === "" || valor === null || valor === undefined) return null;
  const numero = Number(valor);
  return Number.isNaN(numero) ? null : numero;
};

const asegurarTablasInventario = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_products (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      ingrediente_activo VARCHAR(150),
      proveedor VARCHAR(150),
      existencia NUMERIC DEFAULT 0,
      unidad VARCHAR(30) DEFAULT 'L',
      costo_unitario NUMERIC,
      fecha_vencimiento DATE,
      estado VARCHAR(30) DEFAULT 'Activo',
      creado_en TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_batches (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      inventory_product_id INTEGER NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
      codigo_lote VARCHAR(100),
      proveedor VARCHAR(150),
      cantidad_inicial NUMERIC NOT NULL DEFAULT 0,
      cantidad_disponible NUMERIC NOT NULL DEFAULT 0,
      unidad VARCHAR(30) DEFAULT 'L',
      costo_unitario NUMERIC,
      fecha_compra DATE,
      fecha_vencimiento DATE,
      estado VARCHAR(30) DEFAULT 'Activo',
      observaciones TEXT,
      creado_en TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      inventory_product_id INTEGER NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
      inventory_batch_id INTEGER REFERENCES inventory_batches(id) ON DELETE SET NULL,
      application_id INTEGER,
      tipo VARCHAR(30) NOT NULL,
      cantidad NUMERIC NOT NULL DEFAULT 0,
      unidad VARCHAR(30),
      existencia_anterior NUMERIC,
      existencia_nueva NUMERIC,
      descripcion TEXT,
      creado_en TIMESTAMP DEFAULT NOW()
    )
  `);
};

export const getInventoryProducts = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    await asegurarTablasInventario();

    const result = await pool.query(
      `
      SELECT
        p.id,
        p.company_id,
        p.nombre,
        p.ingrediente_activo,
        p.proveedor,
        COALESCE(SUM(
          CASE 
            WHEN b.estado = 'Activo' THEN b.cantidad_disponible
            ELSE 0
          END
        ), p.existencia, 0) AS existencia,
        p.unidad,
        p.costo_unitario,
        MIN(
          CASE 
            WHEN b.estado = 'Activo' 
            AND b.cantidad_disponible > 0 
            THEN b.fecha_vencimiento 
          END
        ) AS fecha_vencimiento,
        p.estado,
        p.creado_en
      FROM inventory_products p
      LEFT JOIN inventory_batches b 
        ON b.inventory_product_id = p.id
        AND b.company_id = p.company_id
      WHERE p.company_id = $1
      GROUP BY p.id
      ORDER BY p.id DESC
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
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await asegurarTablasInventario();

    const companyId = obtenerCompanyId(req);

    if (!companyId) {
      await client.query("ROLLBACK");
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
      codigo_lote,
      fecha_compra,
      observaciones,
    } = req.body;

    if (!nombre || nombre.trim() === "") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        mensaje: "El nombre del producto es obligatorio.",
      });
    }

    const existenciaNumero = normalizarNumero(existencia) || 0;
    const unidadFinal = unidad || "L";

    const productoResult = await client.query(
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
        existenciaNumero,
        unidadFinal,
        normalizarNumero(costo_unitario),
        fecha_vencimiento || null,
        estado || "Activo",
      ]
    );

    const producto = productoResult.rows[0];

    if (existenciaNumero > 0) {
      const batchResult = await client.query(
        `
        INSERT INTO inventory_batches (
          company_id,
          inventory_product_id,
          codigo_lote,
          proveedor,
          cantidad_inicial,
          cantidad_disponible,
          unidad,
          costo_unitario,
          fecha_compra,
          fecha_vencimiento,
          estado,
          observaciones
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Activo',$11)
        RETURNING *
        `,
        [
          companyId,
          producto.id,
          codigo_lote || `LOTE-${producto.id}`,
          proveedor || null,
          existenciaNumero,
          existenciaNumero,
          unidadFinal,
          normalizarNumero(costo_unitario),
          fecha_compra || null,
          fecha_vencimiento || null,
          observaciones || "Lote inicial creado con el producto",
        ]
      );

      await client.query(
        `
        INSERT INTO inventory_movements (
          company_id,
          inventory_product_id,
          inventory_batch_id,
          tipo,
          cantidad,
          unidad,
          existencia_anterior,
          existencia_nueva,
          descripcion
        )
        VALUES ($1,$2,$3,'Entrada',$4,$5,0,$6,$7)
        `,
        [
          companyId,
          producto.id,
          batchResult.rows[0].id,
          existenciaNumero,
          unidadFinal,
          existenciaNumero,
          "Entrada inicial de inventario",
        ]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      mensaje: "Producto creado correctamente",
      data: producto,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("ERROR CREATE INVENTORY:", error);

    res.status(500).json({
      mensaje: "Error creando producto de inventario",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const updateInventoryProduct = async (req, res) => {
  try {
    await asegurarTablasInventario();

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
    await asegurarTablasInventario();

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

export const getInventoryBatches = async (req, res) => {
  try {
    await asegurarTablasInventario();

    const companyId = obtenerCompanyId(req);
    const { productId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const result = await pool.query(
      `
      SELECT 
        b.*,
        p.nombre AS producto,
        p.ingrediente_activo
      FROM inventory_batches b
      JOIN inventory_products p ON p.id = b.inventory_product_id
      WHERE b.company_id = $1
      AND b.inventory_product_id = $2
      ORDER BY 
        b.fecha_vencimiento ASC NULLS LAST,
        b.id ASC
      `,
      [companyId, productId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET INVENTORY BATCHES:", error);

    res.status(500).json({
      mensaje: "Error obteniendo lotes de inventario",
      error: error.message,
    });
  }
};

export const createInventoryBatch = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await asegurarTablasInventario();

    const companyId = obtenerCompanyId(req);
    const { productId } = req.params;

    if (!companyId) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const {
      codigo_lote,
      proveedor,
      cantidad,
      unidad,
      costo_unitario,
      fecha_compra,
      fecha_vencimiento,
      observaciones,
    } = req.body;

    const cantidadNumero = normalizarNumero(cantidad);

    if (!cantidadNumero || cantidadNumero <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        mensaje: "La cantidad comprada debe ser mayor a cero.",
      });
    }

    const productoResult = await client.query(
      `
      SELECT *
      FROM inventory_products
      WHERE id = $1
      AND company_id = $2
      `,
      [productId, companyId]
    );

    if (productoResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        mensaje: "Producto no encontrado para esta empresa.",
      });
    }

    const producto = productoResult.rows[0];
    const unidadFinal = unidad || producto.unidad || "L";
    const existenciaAnterior = Number(producto.existencia || 0);
    const existenciaNueva = existenciaAnterior + cantidadNumero;

    const batchResult = await client.query(
      `
      INSERT INTO inventory_batches (
        company_id,
        inventory_product_id,
        codigo_lote,
        proveedor,
        cantidad_inicial,
        cantidad_disponible,
        unidad,
        costo_unitario,
        fecha_compra,
        fecha_vencimiento,
        estado,
        observaciones
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Activo',$11)
      RETURNING *
      `,
      [
        companyId,
        Number(productId),
        codigo_lote || `COMPRA-${Date.now()}`,
        proveedor || producto.proveedor || null,
        cantidadNumero,
        cantidadNumero,
        unidadFinal,
        normalizarNumero(costo_unitario),
        fecha_compra || null,
        fecha_vencimiento || null,
        observaciones || "Entrada por compra",
      ]
    );

    await client.query(
      `
      UPDATE inventory_products
      SET existencia = $1,
          fecha_vencimiento = COALESCE(fecha_vencimiento, $2)
      WHERE id = $3
      AND company_id = $4
      `,
      [existenciaNueva, fecha_vencimiento || null, productId, companyId]
    );

    await client.query(
      `
      INSERT INTO inventory_movements (
        company_id,
        inventory_product_id,
        inventory_batch_id,
        tipo,
        cantidad,
        unidad,
        existencia_anterior,
        existencia_nueva,
        descripcion
      )
      VALUES ($1,$2,$3,'Entrada',$4,$5,$6,$7,$8)
      `,
      [
        companyId,
        Number(productId),
        batchResult.rows[0].id,
        cantidadNumero,
        unidadFinal,
        existenciaAnterior,
        existenciaNueva,
        "Entrada por compra de producto",
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      mensaje: "Lote de inventario creado correctamente",
      data: batchResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("ERROR CREATE INVENTORY BATCH:", error);

    res.status(500).json({
      mensaje: "Error creando lote de inventario",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const getInventoryMovements = async (req, res) => {
  try {
    await asegurarTablasInventario();

    const companyId = obtenerCompanyId(req);
    const { productId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const result = await pool.query(
      `
      SELECT 
        m.*,
        p.nombre AS producto,
        b.codigo_lote,
        b.fecha_vencimiento
      FROM inventory_movements m
      JOIN inventory_products p ON p.id = m.inventory_product_id
      LEFT JOIN inventory_batches b ON b.id = m.inventory_batch_id
      WHERE m.company_id = $1
      AND m.inventory_product_id = $2
      ORDER BY m.id DESC
      `,
      [companyId, productId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET INVENTORY MOVEMENTS:", error);

    res.status(500).json({
      mensaje: "Error obteniendo movimientos de inventario",
      error: error.message,
    });
  }
};