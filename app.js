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
  clipboard: null,
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
  if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;

  if ((event.metaKey || event.ctrlKey) && event.key === "c") {
    if (state.selection) {
      const shape = findShape(state.selection.id);
      if (shape) {
        state.clipboard = JSON.parse(JSON.stringify(shape));
        event.preventDefault();
      }
    }
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === "v") {
    if (state.clipboard) {
      const newShape = JSON.parse(JSON.stringify(state.clipboard));
      newShape.id = `${newShape.type}-${idCounter++}`;
      if (newShape.x !== undefined) {
        newShape.x += 20;
        newShape.y += 20;
      }
      state.shapes.push(newShape);
      state.selection = { id: newShape.id, handle: "center" };
      render();
      event.preventDefault();
    }
    return;
  }

  if (event.metaKey || event.ctrlKey) return;

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

  const hint = document.getElementById("hint");
  if (hint) {
    hint.style.display = state.mode === "select" ? "block" : "none";
  }
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

  if (state.mode === "rectangle") {
    startRectangleCreation(snapped);
    return;
  }

  if (state.mode === "arrow") {
    startArrowCreation(snapped, event);
    return;
  }

  if (state.mode === "text") {
    startTextCreation(snapped);
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
      const endShape = findShapeAtPoint(event);
      state.pendingCreation.endShapeId = endShape?.type === "rectangle" ? endShape.id : null;
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
  if (state.pendingCreation) {
    if (state.pendingCreation.tool === "rectangle") {
      finalizeRectangle();
      return;
    } else if (state.pendingCreation.tool === "arrow") {
      finalizeArrow();
      return;
    }
  }

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
  state.pendingCreation = {
    tool: "rectangle",
    start: point,
    current: point,
  };
  render();
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

  const draggingRight = current.x > start.x;
  const draggingDown = current.y > start.y;

  state.measurement = { x, y, width, height, draggingRight, draggingDown };
}

function startArrowCreation(point, event) {
  const startShape = findShapeAtPoint(event);
  state.pendingCreation = {
    tool: "arrow",
    start: point,
    current: point,
    startShapeId: startShape?.type === "rectangle" ? startShape.id : null,
    startEvent: event,
  };
  render();
}

function finalizeArrow() {
  const { start, current, startShapeId, endShapeId } = state.pendingCreation;
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
    startShapeId: startShapeId || null,
    endShapeId: endShapeId || null,
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

  const draggingRight = handle.includes("right");
  const draggingDown = handle.includes("bottom");

  state.measurement = { x, y, width, height, draggingRight, draggingDown };
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

function findShapeAtPoint(event) {
  const shapeElement = findShapeElement(event.target);
  if (shapeElement) {
    const shapeId = shapeElement.dataset.shapeId;
    return findShape(shapeId);
  }
  return null;
}

function getConnectionPoint(shape, point) {
  if (!shape || shape.type !== "rectangle") return point;

  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;

  const dx = point.x - cx;
  const dy = point.y - cy;

  const angle = Math.atan2(dy, dx);
  const absAngle = Math.abs(angle);

  const halfWidth = shape.width / 2;
  const halfHeight = shape.height / 2;

  if (absAngle < Math.atan2(halfHeight, halfWidth)) {
    return { x: shape.x + shape.width, y: cy };
  } else if (absAngle > Math.PI - Math.atan2(halfHeight, halfWidth)) {
    return { x: shape.x, y: cy };
  } else if (angle > 0) {
    return { x: cx, y: shape.y + shape.height };
  } else {
    return { x: cx, y: shape.y };
  }
}

function getBoardPoint(event) {
  const svg = board;
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x: svgP.x, y: svgP.y };
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

  if (state.mode === "arrow" || state.pendingCreation?.tool === "arrow") {
    state.shapes.forEach((shape) => {
      if (shape.type === "rectangle") {
        renderRectangleSnapPoints(shape);
      }
    });
  }

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
  let x1 = arrow.x1;
  let y1 = arrow.y1;
  let x2 = arrow.x2;
  let y2 = arrow.y2;

  if (arrow.startShapeId) {
    const startShape = findShape(arrow.startShapeId);
    if (startShape) {
      const connPoint = getConnectionPoint(startShape, { x: arrow.x2, y: arrow.y2 });
      x1 = connPoint.x;
      y1 = connPoint.y;
    }
  }

  if (arrow.endShapeId) {
    const endShape = findShape(arrow.endShapeId);
    if (endShape) {
      const connPoint = getConnectionPoint(endShape, { x: arrow.x1, y: arrow.y1 });
      x2 = connPoint.x;
      y2 = connPoint.y;
    }
  }

  const group = createSvgElement("g", {
    class: `shape-arrow${state.selection?.id === arrow.id ? " selected" : ""}`,
    "data-shape-id": arrow.id,
  });

  const line = createSvgElement("line", {
    x1,
    y1,
    x2,
    y2,
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

function renderRectangleSnapPoints(rect) {
  const snapPoints = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x + rect.width / 2, y: rect.y },
    { x: rect.x + rect.width / 2, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height / 2 },
    { x: rect.x + rect.width, y: rect.y + rect.height / 2 },
  ];

  snapPoints.forEach(({ x, y }) => {
    const circle = createSvgElement("circle", {
      cx: x,
      cy: y,
      r: 4,
      class: "snap-point",
    });
    handleLayer.append(circle);
  });
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
      y: rect.y - 2,
      width: 30,
      height: 4,
      handle: "edge-top",
    },
    {
      x: rect.x + rect.width / 2 - 15,
      y: rect.y + rect.height - 2,
      width: 30,
      height: 4,
      handle: "edge-bottom",
    },
    {
      x: rect.x - 2,
      y: rect.y + rect.height / 2 - 15,
      width: 4,
      height: 30,
      handle: "edge-left",
    },
    {
      x: rect.x + rect.width - 2,
      y: rect.y + rect.height / 2 - 15,
      width: 4,
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

function renderMeasurement({ x, y, width, height, draggingRight, draggingDown }) {
  if (draggingDown) {
    const widthTextTop = createSvgElement("text", {
      x: x + width / 2,
      y: y - 6,
      class: "measurement-text",
      "text-anchor": "middle",
    });
    widthTextTop.textContent = `${width}`;
    overlayLayer.append(widthTextTop);
  } else {
    const widthTextBottom = createSvgElement("text", {
      x: x + width / 2,
      y: y + height + 14,
      class: "measurement-text",
      "text-anchor": "middle",
    });
    widthTextBottom.textContent = `${width}`;
    overlayLayer.append(widthTextBottom);
  }

  if (draggingRight) {
    const heightTextLeft = createSvgElement("text", {
      x: x - 10,
      y: y + height / 2,
      class: "measurement-text",
      "text-anchor": "end",
      "dominant-baseline": "middle",
    });
    heightTextLeft.textContent = `${height}`;
    overlayLayer.append(heightTextLeft);
  } else {
    const heightTextRight = createSvgElement("text", {
      x: x + width + 10,
      y: y + height / 2,
      class: "measurement-text",
      "text-anchor": "start",
      "dominant-baseline": "middle",
    });
    heightTextRight.textContent = `${height}`;
    overlayLayer.append(heightTextRight);
  }
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
