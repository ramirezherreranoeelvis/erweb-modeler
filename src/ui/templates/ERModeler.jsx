import React, { useState, useRef } from "react";
import {
      Database,
      Plus,
      Trash2,
      Save,
      Settings,
      Key,
      Link as LinkIcon,
      ZoomIn,
      ZoomOut,
      X,
      Eye,
} from "lucide-react";

/**
 * ERwin-style Web Data Modeler
 * - Advanced visibility controls (PK, FK, Unique, Identity, Types, Nulls).
 * - Extended Column Properties (Unique, Identity).
 * - Auto-FK removal on relationship delete.
 * - SQL Logic:
 * - PK implies Not Null.
 * - Identity implies Not Null.
 * - Nullable implies NOT PK and NOT Identity.
 */

const ERModeler = () => {
      // --- State ---
      const [tables, setTables] = useState([
            {
                  id: "t1",
                  name: "USUARIOS",
                  logicalName: "Usuario del Sistema",
                  x: 100,
                  y: 100,
                  columns: [
                        {
                              id: "c1",
                              name: "user_id",
                              logicalName: "ID Usuario",
                              type: "INT",
                              length: "",
                              isPk: true,
                              isFk: false,
                              isNullable: false,
                              isUnique: true,
                              isIdentity: true,
                        },
                        {
                              id: "c2",
                              name: "email",
                              logicalName: "Correo",
                              type: "VARCHAR",
                              length: "150",
                              isPk: false,
                              isFk: false,
                              isNullable: false,
                              isUnique: true,
                              isIdentity: false,
                        },
                  ],
            },
            {
                  id: "t2",
                  name: "PEDIDOS",
                  logicalName: "Pedido de Venta",
                  x: 500,
                  y: 150,
                  columns: [
                        {
                              id: "c1",
                              name: "order_id",
                              logicalName: "Nro Pedido",
                              type: "BIGINT",
                              length: "",
                              isPk: true,
                              isFk: false,
                              isNullable: false,
                              isUnique: true,
                              isIdentity: true,
                        },
                        {
                              id: "c2",
                              name: "user_id",
                              logicalName: "ID Usuario",
                              type: "INT",
                              length: "",
                              isPk: false,
                              isFk: true,
                              isNullable: false,
                              isUnique: false,
                              isIdentity: false,
                        },
                        {
                              id: "c3",
                              name: "total",
                              logicalName: "Monto Total",
                              type: "DECIMAL",
                              length: "10,2",
                              isPk: false,
                              isFk: false,
                              isNullable: true,
                              isUnique: false,
                              isIdentity: false,
                        },
                  ],
            },
      ]);

      const [relationships, setRelationships] = useState([
            {
                  id: "r1",
                  fromTable: "t1",
                  fromCol: "c1",
                  toTable: "t2",
                  toCol: "c2",
                  type: "1:N",
            },
      ]);

      // View Options State
      const [viewOptions, setViewOptions] = useState({
            showTypes: true,
            showLength: true,
            showNulls: true,
            showPk: true,
            showFk: true,
            showUnique: true,
            showIdentity: true,
      });

      const [viewMode, setViewMode] = useState("physical"); // 'physical' | 'logical'
      const [selectedId, setSelectedId] = useState(null); // Table ID selection
      const [zoom, setZoom] = useState(1);

      // Dragging / Moving Tables
      const [dragInfo, setDragInfo] = useState({
            isDragging: false,
            offset: { x: 0, y: 0 },
            targetId: null,
      });

      // Connecting Lines State
      const [isConnecting, setIsConnecting] = useState(false);
      const [tempConnection, setTempConnection] = useState(null);
      const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

      // Relationship Menu State
      const [relMenu, setRelMenu] = useState(null);

      // --- Constants ---
      const TABLE_WIDTH = 280;
      const HEADER_HEIGHT = 40;
      const ROW_HEIGHT = 28;

      // --- Helpers ---
      const generateId = () => Math.random().toString(36).substr(2, 9);

      // --- Main Event Handlers (Canvas) ---

      const handleMouseMove = (e) => {
            const canvasRect = e.currentTarget.getBoundingClientRect();
            const rawX = e.clientX - canvasRect.left;
            const rawY = e.clientY - canvasRect.top;
            const x = rawX / zoom;
            const y = rawY / zoom;

            setMousePos({ x: rawX, y: rawY });

            if (dragInfo.isDragging && dragInfo.targetId) {
                  setTables(
                        tables.map((t) =>
                              t.id === dragInfo.targetId
                                    ? {
                                            ...t,
                                            x: x - dragInfo.offset.x,
                                            y: y - dragInfo.offset.y,
                                      }
                                    : t,
                        ),
                  );
                  return;
            }
      };

      const handleMouseUp = () => {
            setDragInfo({
                  isDragging: false,
                  offset: { x: 0, y: 0 },
                  targetId: null,
            });
            if (isConnecting) {
                  setIsConnecting(false);
                  setTempConnection(null);
            }
      };

      const handleTableMouseDown = (e, id) => {
            e.stopPropagation();
            setRelMenu(null);

            const rect = e.currentTarget.getBoundingClientRect();
            const offsetX = (e.clientX - rect.left) / zoom;
            const offsetY = (e.clientY - rect.top) / zoom;

            setDragInfo({
                  isDragging: true,
                  offset: { x: offsetX, y: offsetY },
                  targetId: id,
            });
            setSelectedId(id);
      };

      // --- Connection Logic ---

      const startConnection = (e, tableId, colId, side) => {
            e.stopPropagation();
            e.preventDefault();
            setRelMenu(null);

            const table = tables.find((t) => t.id === tableId);
            const colIndex = table.columns.findIndex((c) => c.id === colId);

            const relativeY =
                  HEADER_HEIGHT + colIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
            const startX = side === "right" ? table.x + TABLE_WIDTH : table.x;
            const startY = table.y + relativeY;

            setIsConnecting(true);
            setTempConnection({
                  sourceTableId: tableId,
                  sourceColId: colId,
                  startX,
                  startY,
                  side,
            });
      };

      const completeConnection = (e, targetTableId, targetColId) => {
            if (isConnecting && tempConnection) {
                  e.stopPropagation();

                  const exists = relationships.find(
                        (r) =>
                              (r.fromTable === tempConnection.sourceTableId &&
                                    r.fromCol === tempConnection.sourceColId &&
                                    r.toTable === targetTableId &&
                                    r.toCol === targetColId) ||
                              (r.toTable === tempConnection.sourceTableId &&
                                    r.toCol === tempConnection.sourceColId &&
                                    r.fromTable === targetTableId &&
                                    r.fromCol === targetColId),
                  );

                  if (!exists) {
                        const newRel = {
                              id: generateId(),
                              fromTable: tempConnection.sourceTableId,
                              fromCol: tempConnection.sourceColId,
                              toTable: targetTableId,
                              toCol: targetColId,
                              type: "1:N",
                        };
                        setRelationships([...relationships, newRel]);

                        // Auto-mark FK
                        updateColumn(targetTableId, targetColId, "isFk", true);
                  }

                  setIsConnecting(false);
                  setTempConnection(null);
            }
      };

      // --- Property Management ---

      const addTable = () => {
            const newTable = {
                  id: generateId(),
                  name: "NUEVA_TABLA",
                  logicalName: "Entidad Nueva",
                  x: 100 + Math.random() * 50,
                  y: 100 + Math.random() * 50,
                  columns: [
                        {
                              id: generateId(),
                              name: "id",
                              logicalName: "ID",
                              type: "INT",
                              length: "",
                              isPk: true,
                              isFk: false,
                              isNullable: false,
                              isUnique: false,
                              isIdentity: true,
                        },
                  ],
            };
            setTables([...tables, newTable]);
            setSelectedId(newTable.id);
      };

      const deleteTable = () => {
            if (!selectedId) return;
            setTables(tables.filter((t) => t.id !== selectedId));
            setRelationships(
                  relationships.filter(
                        (r) =>
                              r.fromTable !== selectedId &&
                              r.toTable !== selectedId,
                  ),
            );
            setSelectedId(null);
      };

      const updateTable = (id, field, value) => {
            setTables(
                  tables.map((t) =>
                        t.id === id ? { ...t, [field]: value } : t,
                  ),
            );
      };

      const addColumn = (tableId) => {
            const newCol = {
                  id: generateId(),
                  name: "new_col",
                  logicalName: "Atributo",
                  type: "VARCHAR",
                  length: "45",
                  isPk: false,
                  isFk: false,
                  isNullable: true,
                  isUnique: false,
                  isIdentity: false,
            };
            setTables(
                  tables.map((t) => {
                        if (t.id === tableId)
                              return { ...t, columns: [...t.columns, newCol] };
                        return t;
                  }),
            );
      };

      const updateColumn = (tableId, colId, field, value) => {
            setTables(
                  tables.map((t) => {
                        if (t.id === tableId) {
                              return {
                                    ...t,
                                    columns: t.columns.map((c) => {
                                          if (c.id === colId) {
                                                const updatedCol = {
                                                      ...c,
                                                      [field]: value,
                                                };

                                                // LOGICA SQL AVANZADA / ADVANCED SQL LOGIC

                                                // Case 1: Checking "Nullable" = TRUE
                                                // Impact: Cannot be PK, Cannot be Identity
                                                if (
                                                      field === "isNullable" &&
                                                      value === true
                                                ) {
                                                      updatedCol.isPk = false;
                                                      updatedCol.isIdentity = false;
                                                }

                                                // Case 2: Checking "PK" = TRUE
                                                // Impact: Must be Not Null
                                                if (
                                                      field === "isPk" &&
                                                      value === true
                                                ) {
                                                      updatedCol.isNullable = false;
                                                }

                                                // Case 3: Checking "Identity" = TRUE
                                                // Impact: Must be Not Null
                                                if (
                                                      field === "isIdentity" &&
                                                      value === true
                                                ) {
                                                      updatedCol.isNullable = false;
                                                }

                                                return updatedCol;
                                          }
                                          return c;
                                    }),
                              };
                        }
                        return t;
                  }),
            );
      };

      const deleteColumn = (tableId, colId) => {
            setTables(
                  tables.map((t) => {
                        if (t.id === tableId)
                              return {
                                    ...t,
                                    columns: t.columns.filter(
                                          (c) => c.id !== colId,
                                    ),
                              };
                        return t;
                  }),
            );
      };

      // --- Relationship Management ---

      const handleRelClick = (e, relId) => {
            e.stopPropagation();
            const canvasRect =
                  e.currentTarget.parentElement.getBoundingClientRect();
            setRelMenu({
                  id: relId,
                  x: e.clientX,
                  y: e.clientY,
            });
      };

      const updateRelType = (type) => {
            if (!relMenu) return;
            setRelationships(
                  relationships.map((r) =>
                        r.id === relMenu.id ? { ...r, type } : r,
                  ),
            );
            setRelMenu(null);
      };

      const deleteRel = () => {
            if (!relMenu) return;

            // Find relationship to be deleted
            const rel = relationships.find((r) => r.id === relMenu.id);

            if (rel) {
                  setTables((prev) =>
                        prev.map((t) => {
                              if (t.id === rel.toTable) {
                                    return {
                                          ...t,
                                          columns: t.columns.map((c) =>
                                                c.id === rel.toCol
                                                      ? { ...c, isFk: false }
                                                      : c,
                                          ),
                                    };
                              }
                              return t;
                        }),
                  );
            }

            setRelationships(relationships.filter((r) => r.id !== relMenu.id));
            setRelMenu(null);
      };

      // --- Geometry Calculations ---

      const getCoords = (tableId, colId) => {
            const table = tables.find((t) => t.id === tableId);
            if (!table) return { x: 0, y: 0 };

            const colIndex = table.columns.findIndex((c) => c.id === colId);
            if (colIndex === -1) {
                  return {
                        x: table.x + TABLE_WIDTH / 2,
                        y: table.y + HEADER_HEIGHT / 2,
                  };
            }

            const relativeY =
                  HEADER_HEIGHT + colIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
            return {
                  x: table.x,
                  y: table.y + relativeY,
                  w: TABLE_WIDTH,
                  h: ROW_HEIGHT,
            };
      };

      const calculatePath = (r) => {
            const startObj = getCoords(r.fromTable, r.fromCol);
            const endObj = getCoords(r.toTable, r.toCol);

            let startX = startObj.x + startObj.w;
            let startY = startObj.y;
            let endX = endObj.x;
            let endY = endObj.y;

            let cp1X, cp2X;

            // Self Reference
            if (r.fromTable === r.toTable) {
                  startX = startObj.x + startObj.w;
                  endX = endObj.x + endObj.w;
                  const loopSize = 60;
                  return `M ${startX} ${startY} C ${startX + loopSize} ${startY}, ${endX + loopSize} ${endY}, ${endX} ${endY}`;
            }

            // Dynamic routing
            if (startObj.x + startObj.w + 50 > endObj.x) {
                  if (startObj.x > endObj.x + endObj.w) {
                        startX = startObj.x;
                        endX = endObj.x + endObj.w;
                        cp1X = startX - 80;
                        cp2X = endX + 80;
                  } else {
                        startX = startObj.x + startObj.w;
                        endX = endObj.x;
                        cp1X = startX + 80;
                        cp2X = endX - 80;
                  }
            } else {
                  cp1X = startX + 80;
                  cp2X = endX - 80;
            }

            return `M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`;
      };

      const selectedTable = tables.find((t) => t.id === selectedId);

      return (
            <div
                  className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden"
                  onClick={() => setRelMenu(null)}
            >
                  {/* Top Toolbar */}
                  <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shadow-sm z-10 shrink-0">
                        <div className="flex items-center gap-3">
                              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-1.5 rounded text-white shadow-sm">
                                    <Database size={20} />
                              </div>
                              <div>
                                    <h1 className="font-bold text-base text-slate-700 leading-tight">
                                          ERWeb Modeler
                                    </h1>
                                    <p className="text-[10px] text-slate-400 font-medium">
                                          Diseño de Base de Datos
                                    </p>
                              </div>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                              <button
                                    onClick={() => setViewMode("logical")}
                                    className={`px-4 py-1.5 text-xs font-bold rounded shadow-sm transition-all ${viewMode === "logical" ? "bg-white text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
                              >
                                    Lógico
                              </button>
                              <button
                                    onClick={() => setViewMode("physical")}
                                    className={`px-4 py-1.5 text-xs font-bold rounded shadow-sm transition-all ${viewMode === "physical" ? "bg-white text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
                              >
                                    Físico
                              </button>
                        </div>

                        <div className="flex items-center gap-3">
                              <div className="flex bg-slate-100 rounded-lg p-0.5">
                                    <button
                                          onClick={() =>
                                                setZoom((z) =>
                                                      Math.max(0.5, z - 0.1),
                                                )
                                          }
                                          className="p-1.5 hover:bg-white rounded text-slate-600"
                                    >
                                          <ZoomOut size={16} />
                                    </button>
                                    <span className="px-2 py-1.5 text-xs font-mono text-slate-500 select-none w-12 text-center">
                                          {Math.round(zoom * 100)}%
                                    </span>
                                    <button
                                          onClick={() =>
                                                setZoom((z) =>
                                                      Math.min(2, z + 0.1),
                                                )
                                          }
                                          className="p-1.5 hover:bg-white rounded text-slate-600"
                                    >
                                          <ZoomIn size={16} />
                                    </button>
                              </div>
                              <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded shadow text-xs font-bold">
                                    <Save size={14} /> SQL
                              </button>
                        </div>
                  </header>

                  <div className="flex flex-1 overflow-hidden relative">
                        {/* Left Toolbar */}
                        <aside className="w-56 bg-white border-r border-slate-200 flex flex-col p-3 z-10 shadow-sm shrink-0 gap-4 overflow-y-auto">
                              {/* Actions */}
                              <div className="grid grid-cols-2 gap-2">
                                    <button
                                          onClick={addTable}
                                          className="flex flex-col items-center justify-center p-3 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 rounded-lg text-blue-700 transition-all gap-1 group"
                                    >
                                          <Plus size={20} />
                                          <span className="text-[10px] font-bold">
                                                Nueva Tabla
                                          </span>
                                    </button>

                                    <button
                                          onClick={deleteTable}
                                          disabled={!selectedId}
                                          className={`flex flex-col items-center justify-center p-3 border rounded-lg transition-all gap-1 ${selectedId ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100" : "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"}`}
                                    >
                                          <Trash2 size={20} />
                                          <span className="text-[10px] font-bold">
                                                Eliminar
                                          </span>
                                    </button>
                              </div>

                              <div className="h-[1px] bg-slate-200"></div>

                              {/* Visibility Options */}
                              <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1">
                                          <Eye size={12} /> Opciones de Vista
                                    </h3>
                                    <div className="space-y-2">
                                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-blue-600">
                                                <input
                                                      type="checkbox"
                                                      checked={
                                                            viewOptions.showPk
                                                      }
                                                      onChange={(e) =>
                                                            setViewOptions({
                                                                  ...viewOptions,
                                                                  showPk: e
                                                                        .target
                                                                        .checked,
                                                            })
                                                      }
                                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                                />
                                                Ver PK (Llave)
                                          </label>
                                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-blue-600">
                                                <input
                                                      type="checkbox"
                                                      checked={
                                                            viewOptions.showTypes
                                                      }
                                                      onChange={(e) =>
                                                            setViewOptions({
                                                                  ...viewOptions,
                                                                  showTypes:
                                                                        e.target
                                                                              .checked,
                                                            })
                                                      }
                                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                                />
                                                Ver Tipos de Dato
                                          </label>
                                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-blue-600">
                                                <input
                                                      type="checkbox"
                                                      checked={
                                                            viewOptions.showLength
                                                      }
                                                      onChange={(e) =>
                                                            setViewOptions({
                                                                  ...viewOptions,
                                                                  showLength:
                                                                        e.target
                                                                              .checked,
                                                            })
                                                      }
                                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                                />
                                                Ver Peso (Longitud)
                                          </label>
                                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-blue-600">
                                                <input
                                                      type="checkbox"
                                                      checked={
                                                            viewOptions.showNulls
                                                      }
                                                      onChange={(e) =>
                                                            setViewOptions({
                                                                  ...viewOptions,
                                                                  showNulls:
                                                                        e.target
                                                                              .checked,
                                                            })
                                                      }
                                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                                />
                                                Ver Null / Not Null
                                          </label>
                                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-blue-600">
                                                <input
                                                      type="checkbox"
                                                      checked={
                                                            viewOptions.showUnique
                                                      }
                                                      onChange={(e) =>
                                                            setViewOptions({
                                                                  ...viewOptions,
                                                                  showUnique:
                                                                        e.target
                                                                              .checked,
                                                            })
                                                      }
                                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                                />
                                                Ver Unique (UQ)
                                          </label>
                                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-blue-600">
                                                <input
                                                      type="checkbox"
                                                      checked={
                                                            viewOptions.showIdentity
                                                      }
                                                      onChange={(e) =>
                                                            setViewOptions({
                                                                  ...viewOptions,
                                                                  showIdentity:
                                                                        e.target
                                                                              .checked,
                                                            })
                                                      }
                                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                                />
                                                Ver Identity (ID)
                                          </label>
                                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-blue-600">
                                                <input
                                                      type="checkbox"
                                                      checked={
                                                            viewOptions.showFk
                                                      }
                                                      onChange={(e) =>
                                                            setViewOptions({
                                                                  ...viewOptions,
                                                                  showFk: e
                                                                        .target
                                                                        .checked,
                                                            })
                                                      }
                                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                                />
                                                Ver Indicador FK
                                          </label>
                                    </div>
                              </div>
                        </aside>

                        {/* Main Canvas Area */}
                        <main
                              className="flex-1 bg-slate-50 relative overflow-hidden"
                              onMouseMove={handleMouseMove}
                              onMouseUp={handleMouseUp}
                              style={{
                                    backgroundImage:
                                          "radial-gradient(#cbd5e1 1px, transparent 1px)",
                                    backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                                    cursor: isConnecting
                                          ? "crosshair"
                                          : dragInfo.isDragging
                                            ? "grabbing"
                                            : "grab",
                              }}
                        >
                              <div
                                    className="absolute top-0 left-0 w-full h-full origin-top-left"
                                    style={{ transform: `scale(${zoom})` }}
                              >
                                    {/* SVG Layer */}
                                    <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none z-0">
                                          <defs>
                                                <marker
                                                      id="oneStart"
                                                      markerWidth="12"
                                                      markerHeight="12"
                                                      refX="0"
                                                      refY="6"
                                                      orient="auto"
                                                >
                                                      <line
                                                            x1="1"
                                                            y1="0"
                                                            x2="1"
                                                            y2="12"
                                                            stroke="#475569"
                                                            strokeWidth="1.5"
                                                      />
                                                      <line
                                                            x1="5"
                                                            y1="0"
                                                            x2="5"
                                                            y2="12"
                                                            stroke="#475569"
                                                            strokeWidth="1.5"
                                                      />
                                                </marker>

                                                <marker
                                                      id="manyEnd"
                                                      markerWidth="12"
                                                      markerHeight="12"
                                                      refX="11"
                                                      refY="6"
                                                      orient="auto"
                                                >
                                                      <path
                                                            d="M0,6 L11,6 M11,0 L0,6 L11,12"
                                                            fill="none"
                                                            stroke="#475569"
                                                            strokeWidth="1.5"
                                                      />
                                                      <line
                                                            x1="7"
                                                            y1="0"
                                                            x2="7"
                                                            y2="12"
                                                            stroke="#475569"
                                                            strokeWidth="1.5"
                                                      />
                                                </marker>

                                                <marker
                                                      id="oneEnd"
                                                      markerWidth="12"
                                                      markerHeight="12"
                                                      refX="11"
                                                      refY="6"
                                                      orient="auto"
                                                >
                                                      <line
                                                            x1="7"
                                                            y1="0"
                                                            x2="7"
                                                            y2="12"
                                                            stroke="#475569"
                                                            strokeWidth="1.5"
                                                      />
                                                      <line
                                                            x1="11"
                                                            y1="0"
                                                            x2="11"
                                                            y2="12"
                                                            stroke="#475569"
                                                            strokeWidth="1.5"
                                                      />
                                                </marker>
                                          </defs>

                                          {relationships.map((rel) => {
                                                const d = calculatePath(rel);
                                                const isSelected =
                                                      relMenu &&
                                                      relMenu.id === rel.id;

                                                let startM = "url(#oneStart)";
                                                let endM = "url(#manyEnd)";

                                                if (rel.type === "1:1") {
                                                      endM = "url(#oneEnd)";
                                                }
                                                if (rel.type === "N:M") {
                                                      startM = "url(#manyEnd)";
                                                      endM = "url(#manyEnd)";
                                                }
                                                if (rel.type === "N:1") {
                                                      startM = "url(#manyEnd)";
                                                      endM = "url(#oneEnd)";
                                                }

                                                return (
                                                      <g
                                                            key={rel.id}
                                                            className="pointer-events-auto cursor-pointer group"
                                                            onClick={(e) =>
                                                                  handleRelClick(
                                                                        e,
                                                                        rel.id,
                                                                  )
                                                            }
                                                      >
                                                            <path
                                                                  d={d}
                                                                  stroke="transparent"
                                                                  strokeWidth="15"
                                                                  fill="none"
                                                            />
                                                            <path
                                                                  d={d}
                                                                  stroke={
                                                                        isSelected
                                                                              ? "#2563eb"
                                                                              : "#475569"
                                                                  }
                                                                  strokeWidth={
                                                                        isSelected
                                                                              ? "2.5"
                                                                              : "1.5"
                                                                  }
                                                                  fill="none"
                                                                  markerStart={
                                                                        startM
                                                                  }
                                                                  markerEnd={
                                                                        endM
                                                                  }
                                                                  className="transition-colors duration-200"
                                                            />
                                                      </g>
                                                );
                                          })}

                                          {isConnecting && tempConnection && (
                                                <path
                                                      d={`M ${tempConnection.startX} ${tempConnection.startY} L ${mousePos.x / zoom} ${mousePos.y / zoom}`}
                                                      stroke="#3b82f6"
                                                      strokeWidth="2"
                                                      strokeDasharray="5,5"
                                                      fill="none"
                                                      markerEnd="url(#manyEnd)"
                                                />
                                          )}
                                    </svg>

                                    {/* Tables */}
                                    {tables.map((table) => (
                                          <div
                                                key={table.id}
                                                onMouseDown={(e) =>
                                                      handleTableMouseDown(
                                                            e,
                                                            table.id,
                                                      )
                                                }
                                                className={`absolute bg-white border shadow-sm rounded-lg overflow-visible select-none transition-shadow
                  ${selectedId === table.id ? "border-blue-500 shadow-xl ring-2 ring-blue-100 z-10" : "border-slate-300 hover:border-slate-400 z-0"}
                `}
                                                style={{
                                                      left: table.x,
                                                      top: table.y,
                                                      width: TABLE_WIDTH,
                                                }}
                                          >
                                                {/* Header */}
                                                <div
                                                      className={`px-3 py-2 border-b border-slate-200 ${selectedId === table.id ? "bg-gradient-to-r from-blue-50 to-white" : "bg-slate-50"}`}
                                                >
                                                      <div className="font-bold text-slate-800 text-sm truncate leading-tight">
                                                            {viewMode ===
                                                            "physical"
                                                                  ? table.name
                                                                  : table.logicalName}
                                                      </div>
                                                      {viewMode ===
                                                            "logical" && (
                                                            <div className="text-[10px] text-slate-400 font-mono truncate">
                                                                  {table.name}
                                                            </div>
                                                      )}
                                                </div>

                                                {/* Columns */}
                                                <div className="flex flex-col bg-white rounded-b-lg pb-1">
                                                      {table.columns.map(
                                                            (col) => (
                                                                  <div
                                                                        key={
                                                                              col.id
                                                                        }
                                                                        className="group/row relative flex items-center px-3 py-1 text-xs h-[28px] hover:bg-blue-50 border-b border-transparent hover:border-blue-100"
                                                                        onMouseUp={(
                                                                              e,
                                                                        ) =>
                                                                              completeConnection(
                                                                                    e,
                                                                                    table.id,
                                                                                    col.id,
                                                                              )
                                                                        }
                                                                  >
                                                                        {/* Connection Dots */}
                                                                        <div
                                                                              className="hidden group-hover/row:block absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-crosshair shadow-sm hover:scale-125 transition-transform z-20"
                                                                              onMouseDown={(
                                                                                    e,
                                                                              ) =>
                                                                                    startConnection(
                                                                                          e,
                                                                                          table.id,
                                                                                          col.id,
                                                                                          "left",
                                                                                    )
                                                                              }
                                                                        ></div>
                                                                        <div
                                                                              className="hidden group-hover/row:block absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-crosshair shadow-sm hover:scale-125 transition-transform z-20"
                                                                              onMouseDown={(
                                                                                    e,
                                                                              ) =>
                                                                                    startConnection(
                                                                                          e,
                                                                                          table.id,
                                                                                          col.id,
                                                                                          "right",
                                                                                    )
                                                                              }
                                                                        ></div>

                                                                        {/* Icons Column */}
                                                                        <div className="w-10 shrink-0 flex items-center gap-0.5">
                                                                              {viewOptions.showPk &&
                                                                              col.isPk ? (
                                                                                    <Key
                                                                                          size={
                                                                                                12
                                                                                          }
                                                                                          className="text-amber-500 rotate-45"
                                                                                          fill="currentColor"
                                                                                    />
                                                                              ) : (
                                                                                    <span className="w-3"></span>
                                                                              )}

                                                                              {viewOptions.showFk &&
                                                                                    col.isFk &&
                                                                                    !col.isPk && (
                                                                                          <div className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1 rounded border border-slate-200">
                                                                                                FK
                                                                                          </div>
                                                                                    )}
                                                                        </div>

                                                                        {/* Name Column */}
                                                                        <div className="flex-1 truncate mr-2">
                                                                              <span
                                                                                    className={
                                                                                          col.isPk
                                                                                                ? "font-bold text-slate-800"
                                                                                                : "text-slate-600"
                                                                                    }
                                                                              >
                                                                                    {viewMode ===
                                                                                    "physical"
                                                                                          ? col.name
                                                                                          : col.logicalName}
                                                                              </span>
                                                                        </div>

                                                                        {/* Details Column (Right aligned) */}
                                                                        <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400">
                                                                              {viewMode ===
                                                                                    "physical" && (
                                                                                    <>
                                                                                          {viewOptions.showTypes && (
                                                                                                <span>
                                                                                                      {
                                                                                                            col.type
                                                                                                      }
                                                                                                </span>
                                                                                          )}
                                                                                          {viewOptions.showTypes &&
                                                                                                viewOptions.showLength &&
                                                                                                col.length && (
                                                                                                      <span className="text-slate-300">
                                                                                                            (
                                                                                                            {
                                                                                                                  col.length
                                                                                                            }

                                                                                                            )
                                                                                                      </span>
                                                                                                )}
                                                                                    </>
                                                                              )}

                                                                              {/* Badges for Unique and Identity */}
                                                                              {viewOptions.showIdentity &&
                                                                                    col.isIdentity && (
                                                                                          <span
                                                                                                className="ml-1 text-[8px] bg-purple-100 text-purple-700 px-1 rounded border border-purple-200 font-bold"
                                                                                                title="Identity / Auto Increment"
                                                                                          >
                                                                                                ID
                                                                                          </span>
                                                                                    )}
                                                                              {viewOptions.showUnique &&
                                                                                    col.isUnique && (
                                                                                          <span
                                                                                                className="ml-0.5 text-[8px] bg-green-100 text-green-700 px-1 rounded border border-green-200 font-bold"
                                                                                                title="Unique Constraint"
                                                                                          >
                                                                                                UQ
                                                                                          </span>
                                                                                    )}

                                                                              {viewOptions.showNulls && (
                                                                                    <span
                                                                                          className={`ml-1 ${col.isNullable ? "text-blue-300" : "text-slate-300 font-bold"}`}
                                                                                    >
                                                                                          {col.isNullable
                                                                                                ? "NULL"
                                                                                                : "NN"}
                                                                                    </span>
                                                                              )}
                                                                        </div>
                                                                  </div>
                                                            ),
                                                      )}
                                                </div>
                                          </div>
                                    ))}
                              </div>
                        </main>

                        {/* Floating Relationship Menu */}
                        {relMenu && (
                              <div
                                    className="fixed bg-white rounded-lg shadow-xl border border-slate-200 p-1 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                                    style={{ left: relMenu.x, top: relMenu.y }}
                                    onClick={(e) => e.stopPropagation()}
                              >
                                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1 border-b border-slate-100 uppercase tracking-wider">
                                          Cardinalidad
                                    </div>
                                    <button
                                          onClick={() => updateRelType("1:1")}
                                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 text-xs text-slate-700 rounded text-left"
                                    >
                                          <span>Uno a Uno (1:1)</span>
                                    </button>
                                    <button
                                          onClick={() => updateRelType("1:N")}
                                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 text-xs text-slate-700 rounded text-left"
                                    >
                                          <span>Uno a Muchos (1:N)</span>
                                    </button>
                                    <button
                                          onClick={() => updateRelType("N:M")}
                                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 text-xs text-slate-700 rounded text-left"
                                    >
                                          <span>Muchos a Muchos</span>
                                    </button>
                                    <div className="h-[1px] bg-slate-100 my-0.5"></div>
                                    <button
                                          onClick={deleteRel}
                                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 text-xs text-red-600 rounded text-left font-medium"
                                    >
                                          <Trash2 size={12} /> Eliminar Relación
                                          y quitar FK
                                    </button>
                              </div>
                        )}

                        {/* Right Properties Panel (Wide for better editing) */}
                        {selectedTable && (
                              <aside className="w-[450px] bg-white border-l border-slate-200 flex flex-col shadow-xl z-20 shrink-0 transition-all">
                                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                                          <h2 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                                <Settings size={16} />{" "}
                                                Propiedades de Tabla
                                          </h2>
                                          <button
                                                onClick={() =>
                                                      setSelectedId(null)
                                                }
                                                className="text-slate-400 hover:text-slate-600"
                                          >
                                                <X size={16} />
                                          </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                          {/* Table Names */}
                                          <div className="grid grid-cols-2 gap-4">
                                                <label className="block">
                                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                                            Nombre Físico
                                                      </span>
                                                      <input
                                                            type="text"
                                                            value={
                                                                  selectedTable.name
                                                            }
                                                            onChange={(e) =>
                                                                  updateTable(
                                                                        selectedTable.id,
                                                                        "name",
                                                                        e.target.value.toUpperCase(),
                                                                  )
                                                            }
                                                            className="mt-1 block w-full rounded border-slate-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs py-2 px-2 border font-mono"
                                                      />
                                                </label>
                                                <label className="block">
                                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                                            Nombre Lógico
                                                      </span>
                                                      <input
                                                            type="text"
                                                            value={
                                                                  selectedTable.logicalName
                                                            }
                                                            onChange={(e) =>
                                                                  updateTable(
                                                                        selectedTable.id,
                                                                        "logicalName",
                                                                        e.target
                                                                              .value,
                                                                  )
                                                            }
                                                            className="mt-1 block w-full rounded border-slate-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs py-2 px-2 border"
                                                      />
                                                </label>
                                          </div>

                                          {/* Columns Editor */}
                                          <div>
                                                <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
                                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                                            Columnas
                                                      </span>
                                                      <button
                                                            onClick={() =>
                                                                  addColumn(
                                                                        selectedTable.id,
                                                                  )
                                                            }
                                                            className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 font-bold border border-blue-100 transition-colors"
                                                      >
                                                            + AÑADIR COLUMNA
                                                      </button>
                                                </div>

                                                <div className="space-y-3">
                                                      {selectedTable.columns.map(
                                                            (col) => (
                                                                  <div
                                                                        key={
                                                                              col.id
                                                                        }
                                                                        className="bg-slate-50 p-3 rounded border border-slate-200 group relative hover:border-blue-300 hover:shadow-sm transition-all"
                                                                  >
                                                                        {/* Row 1: Names */}
                                                                        <div className="flex gap-2 mb-2">
                                                                              <div className="flex-1">
                                                                                    <label className="text-[9px] text-slate-400 font-bold mb-0.5 block">
                                                                                          Físico
                                                                                    </label>
                                                                                    <input
                                                                                          value={
                                                                                                col.name
                                                                                          }
                                                                                          onChange={(
                                                                                                e,
                                                                                          ) =>
                                                                                                updateColumn(
                                                                                                      selectedTable.id,
                                                                                                      col.id,
                                                                                                      "name",
                                                                                                      e
                                                                                                            .target
                                                                                                            .value,
                                                                                                )
                                                                                          }
                                                                                          className="w-full text-xs p-1.5 border border-slate-200 rounded font-mono text-slate-700 bg-white focus:border-blue-400 outline-none"
                                                                                    />
                                                                              </div>
                                                                              <div className="flex-1">
                                                                                    <label className="text-[9px] text-slate-400 font-bold mb-0.5 block">
                                                                                          Lógico
                                                                                    </label>
                                                                                    <input
                                                                                          value={
                                                                                                col.logicalName
                                                                                          }
                                                                                          onChange={(
                                                                                                e,
                                                                                          ) =>
                                                                                                updateColumn(
                                                                                                      selectedTable.id,
                                                                                                      col.id,
                                                                                                      "logicalName",
                                                                                                      e
                                                                                                            .target
                                                                                                            .value,
                                                                                                )
                                                                                          }
                                                                                          className="w-full text-xs p-1.5 border border-slate-200 rounded text-slate-700 bg-white focus:border-blue-400 outline-none"
                                                                                    />
                                                                              </div>
                                                                        </div>

                                                                        {/* Row 2: Types & Attributes */}
                                                                        <div className="flex gap-2 items-end">
                                                                              <div className="w-24 shrink-0">
                                                                                    <label className="text-[9px] text-slate-400 font-bold mb-0.5 block">
                                                                                          Tipo
                                                                                    </label>
                                                                                    <select
                                                                                          value={
                                                                                                col.type
                                                                                          }
                                                                                          onChange={(
                                                                                                e,
                                                                                          ) =>
                                                                                                updateColumn(
                                                                                                      selectedTable.id,
                                                                                                      col.id,
                                                                                                      "type",
                                                                                                      e
                                                                                                            .target
                                                                                                            .value,
                                                                                                )
                                                                                          }
                                                                                          className="w-full text-[10px] py-1.5 px-1 border border-slate-200 rounded bg-white text-slate-700 outline-none"
                                                                                    >
                                                                                          <option value="INT">
                                                                                                INT
                                                                                          </option>
                                                                                          <option value="BIGINT">
                                                                                                BIGINT
                                                                                          </option>
                                                                                          <option value="VARCHAR">
                                                                                                VARCHAR
                                                                                          </option>
                                                                                          <option value="CHAR">
                                                                                                CHAR
                                                                                          </option>
                                                                                          <option value="TEXT">
                                                                                                TEXT
                                                                                          </option>
                                                                                          <option value="DATETIME">
                                                                                                DATETIME
                                                                                          </option>
                                                                                          <option value="DATE">
                                                                                                DATE
                                                                                          </option>
                                                                                          <option value="DECIMAL">
                                                                                                DECIMAL
                                                                                          </option>
                                                                                          <option value="BOOLEAN">
                                                                                                BOOLEAN
                                                                                          </option>
                                                                                    </select>
                                                                              </div>

                                                                              <div className="w-16 shrink-0">
                                                                                    <label className="text-[9px] text-slate-400 font-bold mb-0.5 block">
                                                                                          Long
                                                                                    </label>
                                                                                    <input
                                                                                          placeholder={
                                                                                                col.type ===
                                                                                                "VARCHAR"
                                                                                                      ? "255"
                                                                                                      : ""
                                                                                          }
                                                                                          value={
                                                                                                col.length
                                                                                          }
                                                                                          onChange={(
                                                                                                e,
                                                                                          ) =>
                                                                                                updateColumn(
                                                                                                      selectedTable.id,
                                                                                                      col.id,
                                                                                                      "length",
                                                                                                      e
                                                                                                            .target
                                                                                                            .value,
                                                                                                )
                                                                                          }
                                                                                          disabled={[
                                                                                                "INT",
                                                                                                "BIGINT",
                                                                                                "TEXT",
                                                                                                "DATETIME",
                                                                                                "BOOLEAN",
                                                                                                "DATE",
                                                                                          ].includes(
                                                                                                col.type,
                                                                                          )}
                                                                                          className="w-full text-[10px] p-1.5 border border-slate-200 rounded bg-white text-slate-700 focus:border-blue-400 outline-none disabled:bg-slate-100 disabled:text-slate-300"
                                                                                    />
                                                                              </div>

                                                                              {/* Flags */}
                                                                              <div className="flex flex-1 justify-end items-center gap-1.5 pb-0.5">
                                                                                    {/* Null */}
                                                                                    <label
                                                                                          className="flex flex-col items-center cursor-pointer group/chk"
                                                                                          title="Permitir Null"
                                                                                    >
                                                                                          <span className="text-[8px] font-bold text-slate-400 mb-0.5 group-hover/chk:text-blue-500">
                                                                                                NULL
                                                                                          </span>
                                                                                          <input
                                                                                                type="checkbox"
                                                                                                checked={
                                                                                                      col.isNullable
                                                                                                }
                                                                                                onChange={(
                                                                                                      e,
                                                                                                ) =>
                                                                                                      updateColumn(
                                                                                                            selectedTable.id,
                                                                                                            col.id,
                                                                                                            "isNullable",
                                                                                                            e
                                                                                                                  .target
                                                                                                                  .checked,
                                                                                                      )
                                                                                                }
                                                                                                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                                                                                          />
                                                                                    </label>

                                                                                    {/* Unique */}
                                                                                    <label
                                                                                          className="flex flex-col items-center cursor-pointer group/chk"
                                                                                          title="Restricción Unique"
                                                                                    >
                                                                                          <span className="text-[8px] font-bold text-slate-400 mb-0.5 group-hover/chk:text-green-600">
                                                                                                UQ
                                                                                          </span>
                                                                                          <input
                                                                                                type="checkbox"
                                                                                                checked={
                                                                                                      col.isUnique
                                                                                                }
                                                                                                onChange={(
                                                                                                      e,
                                                                                                ) =>
                                                                                                      updateColumn(
                                                                                                            selectedTable.id,
                                                                                                            col.id,
                                                                                                            "isUnique",
                                                                                                            e
                                                                                                                  .target
                                                                                                                  .checked,
                                                                                                      )
                                                                                                }
                                                                                                className="w-3.5 h-3.5 rounded border-slate-300 text-green-600 focus:ring-0 cursor-pointer"
                                                                                          />
                                                                                    </label>

                                                                                    {/* Identity */}
                                                                                    <label
                                                                                          className={`flex flex-col items-center group/chk ${col.isNullable ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                                                                                          title={
                                                                                                col.isNullable
                                                                                                      ? "No disponible si es NULL"
                                                                                                      : "Identity / Auto Increment"
                                                                                          }
                                                                                    >
                                                                                          <span className="text-[8px] font-bold text-slate-400 mb-0.5 group-hover/chk:text-purple-600">
                                                                                                ID
                                                                                          </span>
                                                                                          <input
                                                                                                type="checkbox"
                                                                                                checked={
                                                                                                      col.isIdentity
                                                                                                }
                                                                                                disabled={
                                                                                                      col.isNullable
                                                                                                } // Deshabilita si es NULL
                                                                                                onChange={(
                                                                                                      e,
                                                                                                ) =>
                                                                                                      updateColumn(
                                                                                                            selectedTable.id,
                                                                                                            col.id,
                                                                                                            "isIdentity",
                                                                                                            e
                                                                                                                  .target
                                                                                                                  .checked,
                                                                                                      )
                                                                                                }
                                                                                                className={`w-3.5 h-3.5 rounded border-slate-300 text-purple-600 focus:ring-0 ${col.isNullable ? "cursor-not-allowed bg-slate-100" : "cursor-pointer"}`}
                                                                                          />
                                                                                    </label>

                                                                                    <div className="w-[1px] h-6 bg-slate-200 mx-0.5"></div>

                                                                                    <button
                                                                                          onClick={() =>
                                                                                                !col.isNullable &&
                                                                                                updateColumn(
                                                                                                      selectedTable.id,
                                                                                                      col.id,
                                                                                                      "isPk",
                                                                                                      !col.isPk,
                                                                                                )
                                                                                          }
                                                                                          disabled={
                                                                                                col.isNullable
                                                                                          } // Deshabilita si es NULL
                                                                                          className={`flex flex-col items-center justify-center w-8 h-8 rounded border transition-all ${
                                                                                                col.isPk
                                                                                                      ? "bg-amber-100 border-amber-200 text-amber-600"
                                                                                                      : col.isNullable
                                                                                                        ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                                                                                        : "bg-white border-slate-200 text-slate-300 hover:border-amber-300 hover:text-amber-400"
                                                                                          }`}
                                                                                          title={
                                                                                                col.isNullable
                                                                                                      ? "No puede ser PK si permite NULL"
                                                                                                      : "Primary Key"
                                                                                          }
                                                                                    >
                                                                                          <Key
                                                                                                size={
                                                                                                      14
                                                                                                }
                                                                                                fill={
                                                                                                      col.isPk
                                                                                                            ? "currentColor"
                                                                                                            : "none"
                                                                                                }
                                                                                          />
                                                                                          <span className="text-[7px] font-bold mt-0.5">
                                                                                                PK
                                                                                          </span>
                                                                                    </button>

                                                                                    <button
                                                                                          onClick={() =>
                                                                                                deleteColumn(
                                                                                                      selectedTable.id,
                                                                                                      col.id,
                                                                                                )
                                                                                          }
                                                                                          className="flex flex-col items-center justify-center w-8 h-8 rounded border bg-white border-slate-200 text-slate-300 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all"
                                                                                          title="Eliminar Columna"
                                                                                    >
                                                                                          <Trash2
                                                                                                size={
                                                                                                      14
                                                                                                }
                                                                                          />
                                                                                    </button>
                                                                              </div>
                                                                        </div>
                                                                  </div>
                                                            ),
                                                      )}
                                                </div>
                                          </div>
                                    </div>
                              </aside>
                        )}
                  </div>
            </div>
      );
};

export default ERModeler;
