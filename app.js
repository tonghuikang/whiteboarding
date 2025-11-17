const svgNS = "http://www.w3.org/2000/svg";
const GRID_SIZE = 20;

const board = document.getElementById("board");
const shapesLayer = document.getElementById("shape-layer");
const handleLayer = document.getElementById("handle-layer");
const overlayLayer = document.getElementById("overlay-layer");
const modeLabel = document.getElementById("mode-label");
const toolButtons = document.querySelectorAll(".tool-button");

let idCounter = 1;

const HANDLE_TEXT_MAP = {
  center: "center",
  "edge-top": "top",
  "edge-bottom": "bottom",
  "edge-left": "left",
  "edge-right": "right",
};

const state = {
  mode: "select",
  shapes: [],
  selection: null,
  pendingCreation: null,
  interaction: null,
  measurement: null,
};

toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextMode = button.dataset.mode;
    setMode(nextMode);
  });
});

board.addEventListener("pointerdown", (event) => {
  board.setPointerCapture(event.pointerId);
  handlePointerDown(event);
});

board.addEventListener("pointermove", (event) => {
  handlePointerMove(event);
});

board.addEventListener("pointerup", (event) => {
  board.releasePointerCapture(event.pointerId);
  handlePointerUp();
});

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey) return;
  if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;

  if (event.key === "Escape") {
    cancelInteractions();
    setMode("select");
    return;
  }

  if (!state.selection) return;
  const shape = findShape(state.selection.id);
  if (!shape) return;

  if (shape.type === "rectangle") {
    handleRectangleTyping(event, shape);
  } else if (shape.type === "text") {
    handleTextTyping(event, shape);
  }
});

function setMode(nextMode) {
  state.mode = nextMode;
  state.pendingCreation = null;
  updateModeLabel();
  updateToolbar();
  render();
}

function updateModeLabel() {
  const labels = {
    select: "Select",
    rectangle: "Rectangle",
    arrow: "Arrow",
    text: "Text",
  };
  modeLabel.textContent = labels[state.mode] || "Select";
}

function updateToolbar() {
  toolButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
}

function handlePointerDown(event) {
  const point = getBoardPoint(event);
  const snapped = snapPoint(point);
  const handle = event.target.dataset.handle;
  const shapeIdFromHandle = event.target.dataset.shapeId;

  if (handle && shapeIdFromHandle) {
    const shape = findShape(shapeIdFromHandle);
    if (!shape || shape.type !== "rectangle") return;
    setSelection(shape.id, handle === "center" ? "center" : handle);
    startResizeInteraction(shape, handle, snapped);
    return;
  }

  const shapeElement = findShapeElement(event.target);
  if (shapeElement) {
    const shapeId = shapeElement.dataset.shapeId;
    const shape = findShape(shapeId);
    if (!shape) return;
    setSelection(shapeId, "center");
    if (shape.type === "rectangle" && state.mode === "select") {
      startMoveInteraction(shape, snapped);
    }
    return;
  }

  if (state.mode === "rectangle") {
    startRectangleCreation(snapped);
    return;
  }

  if (state.mode === "arrow") {
    startArrowCreation(snapped);
    return;
  }

  if (state.mode === "text") {
    startTextCreation(snapped);
    return;
  }

  if (state.mode === "select") {
    state.selection = null;
    render();
  }
}

function handlePointerMove(event) {
  const point = getBoardPoint(event);
  const snapped = snapPoint(point);

  if (state.pendingCreation) {
    if (state.pendingCreation.tool === "rectangle") {
      state.pendingCreation.current = snapped;
      updateMeasurementWithPending();
      render();
    } else if (state.pendingCreation.tool === "arrow") {
      state.pendingCreation.current = snapped;
      render();
    } else if (state.pendingCreation.tool === "text") {
      state.pendingCreation.current = snapped;
      render();
    }
  }

  if (state.interaction) {
    if (state.interaction.type === "resize") {
      resizeRectangle(snapped);
    } else if (state.interaction.type === "move") {
      moveRectangle(snapped);
    }
  }
}

function handlePointerUp() {
  if (state.interaction) {
    state.measurement = null;
    state.interaction = null;
    render();
  }
}

function cancelInteractions() {
  state.pendingCreation = null;
  state.interaction = null;
  state.measurement = null;
  render();
}

function startRectangleCreation(point) {
  if (!state.pendingCreation) {
    state.pendingCreation = {
      tool: "rectangle",
      start: point,
      current: point,
    };
    render();
    return;
  }

  state.pendingCreation.current = point;
  finalizeRectangle();
}

function finalizeRectangle() {
  const { start, current } = state.pendingCreation;
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);

  if (width < GRID_SIZE || height < GRID_SIZE) {
    state.pendingCreation = null;
    setMode("select");
    return;
  }

  const rectangle = {
    id: `rect-${idCounter++}`,
    type: "rectangle",
    x,
    y,
    width,
    height,
    texts: {
      center: "",
      top: "",
      bottom: "",
      left: "",
      right: "",
    },
  };

  state.shapes.push(rectangle);
  state.selection = { id: rectangle.id, handle: "center" };
  state.pendingCreation = null;
  state.measurement = null;
  setMode("select");
}

function updateMeasurementWithPending() {
  const { start, current } = state.pendingCreation;
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  state.measurement = { x, y, width, height };
}

function startArrowCreation(point) {
  if (!state.pendingCreation) {
    state.pendingCreation = {
      tool: "arrow",
      start: point,
      current: point,
    };
    render();
    return;
  }

  state.pendingCreation.current = point;
  finalizeArrow();
}

function finalizeArrow() {
  const { start, current } = state.pendingCreation;
  const samePoint = start.x === current.x && start.y === current.y;
  if (samePoint) {
    state.pendingCreation = null;
    setMode("select");
    return;
  }

  const arrow = {
    id: `arrow-${idCounter++}`,
    type: "arrow",
    x1: start.x,
    y1: start.y,
    x2: current.x,
    y2: current.y,
  };

  state.shapes.push(arrow);
  state.selection = { id: arrow.id, handle: "center" };
  state.pendingCreation = null;
  setMode("select");
}

function startTextCreation(point) {
  if (!state.pendingCreation) {
    state.pendingCreation = {
      tool: "text",
      current: point,
    };
    render();
    return;
  }

  state.pendingCreation.current = point;
  finalizeText();
}

function finalizeText() {
  const { current } = state.pendingCreation;
  const textShape = {
    id: `text-${idCounter++}`,
    type: "text",
    x: current.x,
    y: current.y,
    content: "Text",
  };

  state.shapes.push(textShape);
  state.selection = { id: textShape.id, handle: "center" };
  state.pendingCreation = null;
  setMode("select");
}

function startResizeInteraction(shape, handle, startPoint) {
  state.interaction = {
    type: "resize",
    shapeId: shape.id,
    handle,
    origin: { ...shape },
    startPoint,
  };
}

function startMoveInteraction(shape, startPoint) {
  state.interaction = {
    type: "move",
    shapeId: shape.id,
    origin: { x: shape.x, y: shape.y },
    startPoint,
  };
}

function resizeRectangle(point) {
  const interaction = state.interaction;
  const shape = findShape(interaction.shapeId);
  if (!shape) return;
  const { origin, handle } = interaction;

  let left = origin.x;
  let right = origin.x + origin.width;
  let top = origin.y;
  let bottom = origin.y + origin.height;

  if (handle.includes("right")) {
    right = snap(point.x);
  }
  if (handle.includes("left")) {
    left = snap(point.x);
  }
  if (handle.includes("bottom")) {
    bottom = snap(point.y);
  }
  if (handle.includes("top")) {
    top = snap(point.y);
  }

  if (right - left < GRID_SIZE) {
    if (handle.includes("left")) {
      left = right - GRID_SIZE;
    } else if (handle.includes("right")) {
      right = left + GRID_SIZE;
    }
  }

  if (bottom - top < GRID_SIZE) {
    if (handle.includes("top")) {
      top = bottom - GRID_SIZE;
    } else if (handle.includes("bottom")) {
      bottom = top + GRID_SIZE;
    }
  }

  const x = Math.min(left, right);
  const y = Math.min(top, bottom);
  const width = Math.max(GRID_SIZE, Math.abs(right - left));
  const height = Math.max(GRID_SIZE, Math.abs(bottom - top));

  shape.x = x;
  shape.y = y;
  shape.width = width;
  shape.height = height;

  state.measurement = { x, y, width, height };
  render();
}

function moveRectangle(point) {
  const interaction = state.interaction;
  const shape = findShape(interaction.shapeId);
  if (!shape) return;

  const dx = point.x - interaction.startPoint.x;
  const dy = point.y - interaction.startPoint.y;

  shape.x = snap(interaction.origin.x + dx);
  shape.y = snap(interaction.origin.y + dy);
  render();
}

function handleRectangleTyping(event, shape) {
  const handle = state.selection.handle || "center";
  const targetField = HANDLE_TEXT_MAP[handle] || "center";

  if (event.key === "Backspace") {
    shape.texts[targetField] = shape.texts[targetField].slice(0, -1);
    event.preventDefault();
    render();
    return;
  }

  if (event.key === "Enter") {
    shape.texts[targetField] += "\n";
    event.preventDefault();
    render();
    return;
  }

  if (event.key.length === 1) {
    shape.texts[targetField] += event.key;
    event.preventDefault();
    render();
  }
}

function handleTextTyping(event, shape) {
  if (event.key === "Backspace") {
    shape.content = shape.content.slice(0, -1);
    event.preventDefault();
    render();
    return;
  }

  if (event.key === "Enter") {
    shape.content += "\n";
    event.preventDefault();
    render();
    return;
  }

  if (event.key.length === 1) {
    shape.content += event.key;
    event.preventDefault();
    render();
  }
}

function setSelection(id, handle = "center") {
  state.selection = { id, handle };
  render();
}

function findShape(id) {
  return state.shapes.find((shape) => shape.id === id);
}

function findShapeElement(target) {
  return target.closest?.("[data-shape-id]");
}

function getBoardPoint(event) {
  const bounds = board.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  return { x, y };
}

function snap(value) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function snapPoint(point) {
  return {
    x: snap(point.x),
    y: snap(point.y),
  };
}

function render() {
  shapesLayer.innerHTML = "";
  handleLayer.innerHTML = "";
  overlayLayer.innerHTML = "";

  state.shapes.forEach((shape) => {
    if (shape.type === "rectangle") {
      renderRectangle(shape);
    } else if (shape.type === "arrow") {
      renderArrow(shape);
    } else if (shape.type === "text") {
      renderText(shape);
    }
  });

  if (state.selection) {
    const shape = findShape(state.selection.id);
    if (shape && shape.type === "rectangle") {
      renderRectangleHandles(shape);
    }
  }

  if (state.pendingCreation) {
    renderPending();
  }

  if (state.measurement) {
    renderMeasurement(state.measurement);
  }
}

function renderRectangle(rect) {
  const group = createSvgElement("g", {
    class: "shape-rectangle",
    "data-shape-id": rect.id,
  });

  if (state.selection?.id === rect.id) {
    group.classList.add("selected");
  }

  const rectElement = createSvgElement("rect", {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  });

  group.append(rectElement);

  group.append(
    createTextBlock(rect.texts.center, rect.x + rect.width / 2, rect.y + rect.height / 2, {
      "text-anchor": "middle",
      "dominant-baseline": "middle",
    }),
  );

  group.append(
    createTextBlock(rect.texts.top, rect.x + rect.width / 2, rect.y + 14, {
      "text-anchor": "middle",
    }),
  );

  group.append(
    createTextBlock(rect.texts.bottom, rect.x + rect.width / 2, rect.y + rect.height - 6, {
      "text-anchor": "middle",
    }),
  );

  group.append(
    createTextBlock(rect.texts.left, rect.x + 8, rect.y + rect.height / 2, {
      "dominant-baseline": "middle",
      "text-anchor": "start",
    }),
  );

  group.append(
    createTextBlock(rect.texts.right, rect.x + rect.width - 8, rect.y + rect.height / 2, {
      "dominant-baseline": "middle",
      "text-anchor": "end",
    }),
  );

  shapesLayer.append(group);
}

function renderArrow(arrow) {
  const group = createSvgElement("g", {
    class: `shape-arrow${state.selection?.id === arrow.id ? " selected" : ""}`,
    "data-shape-id": arrow.id,
  });

  const line = createSvgElement("line", {
    x1: arrow.x1,
    y1: arrow.y1,
    x2: arrow.x2,
    y2: arrow.y2,
  });

  group.append(line);
  shapesLayer.append(group);
}

function renderText(shape) {
  const group = createSvgElement("g", {
    class: `shape-text${state.selection?.id === shape.id ? " selected" : ""}`,
    "data-shape-id": shape.id,
  });

  const textBlock = createTextBlock(shape.content, shape.x, shape.y, {
    "text-anchor": "start",
    "dominant-baseline": "hanging",
  });

  group.append(textBlock);
  shapesLayer.append(group);
}

function renderRectangleHandles(rect) {
  const corners = [
    { x: rect.x, y: rect.y, handle: "corner-top-left" },
    { x: rect.x + rect.width, y: rect.y, handle: "corner-top-right" },
    { x: rect.x, y: rect.y + rect.height, handle: "corner-bottom-left" },
    { x: rect.x + rect.width, y: rect.y + rect.height, handle: "corner-bottom-right" },
  ];

  corners.forEach(({ x, y, handle }) => {
    const handleRect = createSvgElement("rect", {
      x: x - 6,
      y: y - 6,
      width: 12,
      height: 12,
      class: "corner-handle",
      "data-handle": handle,
      "data-shape-id": rect.id,
    });
    handleLayer.append(handleRect);
  });

  const edges = [
    {
      x: rect.x + rect.width / 2 - 15,
      y: rect.y - 4,
      width: 30,
      height: 8,
      handle: "edge-top",
    },
    {
      x: rect.x + rect.width / 2 - 15,
      y: rect.y + rect.height - 4,
      width: 30,
      height: 8,
      handle: "edge-bottom",
    },
    {
      x: rect.x - 4,
      y: rect.y + rect.height / 2 - 15,
      width: 8,
      height: 30,
      handle: "edge-left",
    },
    {
      x: rect.x + rect.width - 4,
      y: rect.y + rect.height / 2 - 15,
      width: 8,
      height: 30,
      handle: "edge-right",
    },
  ];

  edges.forEach(({ x, y, width, height, handle }) => {
    const handleRect = createSvgElement("rect", {
      x,
      y,
      width,
      height,
      class: `edge-handle${state.selection?.handle === handle ? " active" : ""}`,
      "data-handle": handle,
      "data-shape-id": rect.id,
    });
    handleLayer.append(handleRect);
  });
}

function renderPending() {
  if (state.pendingCreation.tool === "rectangle") {
    const { start, current } = state.pendingCreation;
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    const ghostRect = createSvgElement("rect", {
      x,
      y,
      width,
      height,
      class: "ghost-rectangle",
    });

    overlayLayer.append(ghostRect);
  } else if (state.pendingCreation.tool === "arrow") {
    const { start, current } = state.pendingCreation;
    const ghostArrow = createSvgElement("line", {
      x1: start.x,
      y1: start.y,
      x2: current.x,
      y2: current.y,
      class: "ghost-arrow",
    });
    overlayLayer.append(ghostArrow);
  } else if (state.pendingCreation.tool === "text") {
    const { current } = state.pendingCreation;
    const hint = createSvgElement("text", {
      x: current.x,
      y: current.y,
      class: "measurement-text",
      "text-anchor": "middle",
    });
    hint.textContent = "Click to place text";
    overlayLayer.append(hint);
  }
}

function renderMeasurement({ x, y, width, height }) {
  const widthTextTop = createSvgElement("text", {
    x: x + width / 2,
    y: y - 6,
    class: "measurement-text",
    "text-anchor": "middle",
  });
  widthTextTop.textContent = `${width}px`;

  const widthTextBottom = createSvgElement("text", {
    x: x + width / 2,
    y: y + height + 14,
    class: "measurement-text",
    "text-anchor": "middle",
  });
  widthTextBottom.textContent = `${width}px`;

  const heightTextLeft = createSvgElement("text", {
    x: x - 10,
    y: y + height / 2,
    class: "measurement-text",
    "text-anchor": "end",
    "dominant-baseline": "middle",
  });
  heightTextLeft.textContent = `${height}px`;

  const heightTextRight = createSvgElement("text", {
    x: x + width + 10,
    y: y + height / 2,
    class: "measurement-text",
    "text-anchor": "start",
    "dominant-baseline": "middle",
  });
  heightTextRight.textContent = `${height}px`;

  overlayLayer.append(widthTextTop, widthTextBottom, heightTextLeft, heightTextRight);
}

function createTextBlock(content, x, y, attrs = {}) {
  const textElement = createSvgElement("text", { x, y, ...attrs });
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    const tspan = createSvgElement("tspan", {
      x,
      dy: index === 0 ? 0 : "1.2em",
    });
    tspan.textContent = line || " ";
    textElement.append(tspan);
  });
  return textElement;
}

function createSvgElement(tag, attributes = {}) {
  const element = document.createElementNS(svgNS, tag);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

render();
