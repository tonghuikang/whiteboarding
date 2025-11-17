// Grid settings
const GRID_SIZE = 20;

// Current state
let currentTool = 'select';
let selectedElement = null;
let selectedEdge = null;
let isDrawing = false;
let startPoint = { x: 0, y: 0 };
let currentShape = null;
let shapes = [];
let isDragging = false;
let isResizingEdge = false;
let dragOffset = { x: 0, y: 0 };
let copiedElement = null;

// Get DOM elements
const canvas = document.getElementById('canvas');
const drawingLayer = document.getElementById('drawingLayer');
const fillColorInput = document.getElementById('fillColor');
const strokeColorInput = document.getElementById('strokeColor');
const strokeWidthInput = document.getElementById('strokeWidth');
const strokeWidthValue = document.getElementById('strokeWidthValue');

// Snap to grid function
function snapToGrid(value) {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// Get mouse position relative to SVG
function getMousePosition(event) {
    const CTM = canvas.getScreenCTM();
    return {
        x: snapToGrid((event.clientX - CTM.e) / CTM.a),
        y: snapToGrid((event.clientY - CTM.f) / CTM.d)
    };
}

// Tool selection
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.id.replace('Tool', '');
        deselectElement();
    });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Copy/Paste
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedElement) {
            copiedElement = selectedElement.cloneNode(true);
            e.preventDefault();
        }
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (copiedElement) {
            pasteElement();
            e.preventDefault();
        }
        return;
    }

    switch(e.key.toLowerCase()) {
        case 'v':
            if (!e.ctrlKey && !e.metaKey) {
                document.getElementById('selectTool').click();
            }
            break;
        case 'r':
            document.getElementById('rectangleTool').click();
            break;
        case 't':
            document.getElementById('textTool').click();
            break;
        case 'a':
            document.getElementById('arrowTool').click();
            break;
        case 'delete':
        case 'backspace':
            deleteSelected();
            e.preventDefault();
            break;
    }
});

function pasteElement() {
    const clone = copiedElement.cloneNode(true);
    const type = clone.getAttribute('data-shape');

    if (type === 'rectangle-group') {
        const rect = clone.querySelector('.main-rect');
        const x = parseFloat(rect.getAttribute('x'));
        const y = parseFloat(rect.getAttribute('y'));

        // Offset pasted element
        moveElement(clone, x + 40, y + 40);
    } else if (type === 'text') {
        const x = parseFloat(clone.getAttribute('x'));
        const y = parseFloat(clone.getAttribute('y'));
        clone.setAttribute('x', x + 40);
        clone.setAttribute('y', y + 40);
    } else if (type === 'arrow') {
        const x1 = parseFloat(clone.getAttribute('x1'));
        const y1 = parseFloat(clone.getAttribute('y1'));
        const x2 = parseFloat(clone.getAttribute('x2'));
        const y2 = parseFloat(clone.getAttribute('y2'));
        clone.setAttribute('x1', x1 + 40);
        clone.setAttribute('y1', y1 + 40);
        clone.setAttribute('x2', x2 + 40);
        clone.setAttribute('y2', y2 + 40);
        // Remove anchor data from pasted arrow
        clone.removeAttribute('data-start-anchor');
        clone.removeAttribute('data-end-anchor');
    }

    drawingLayer.appendChild(clone);
    shapes.push(clone);
    selectElement(clone);
}

// Stroke width display
strokeWidthInput.addEventListener('input', (e) => {
    strokeWidthValue.textContent = e.target.value;
});

// Text rotation
const textRotationInput = document.getElementById('textRotation');
const textRotationValue = document.getElementById('textRotationValue');

textRotationInput.addEventListener('input', (e) => {
    const rotation = e.target.value;
    textRotationValue.textContent = rotation + '°';

    // Apply rotation to selected text element
    if (selectedElement && selectedElement.getAttribute('data-shape') === 'text') {
        const x = parseFloat(selectedElement.getAttribute('x'));
        const y = parseFloat(selectedElement.getAttribute('y'));
        selectedElement.setAttribute('transform', `rotate(${rotation}, ${x}, ${y})`);
        selectedElement.setAttribute('data-rotation', rotation);
    }
});

// Canvas mouse events
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('dblclick', handleDoubleClick);

function handleMouseDown(event) {
    const pos = getMousePosition(event);

    if (currentTool === 'select') {
        // Check if clicking on an edge zone
        const edgeZone = event.target.closest('.edge-zone');
        if (edgeZone) {
            const rectGroup = edgeZone.closest('[data-shape="rectangle-group"]');
            const edge = edgeZone.getAttribute('data-edge');
            selectEdge(rectGroup, edge);
            isResizingEdge = true;
            startPoint = pos;
            return;
        }

        const clickedElement = event.target.closest('[data-shape]');
        if (clickedElement && clickedElement !== canvas) {
            selectElement(clickedElement);
            selectedEdge = null;
            isDragging = true;

            // Calculate drag offset based on element type
            const type = clickedElement.getAttribute('data-shape');
            if (type === 'arrow') {
                const x1 = parseFloat(clickedElement.getAttribute('x1'));
                const y1 = parseFloat(clickedElement.getAttribute('y1'));
                dragOffset = {
                    x: pos.x - x1,
                    y: pos.y - y1
                };
            } else if (type === 'rectangle-group') {
                const rect = clickedElement.querySelector('.main-rect');
                const x = parseFloat(rect.getAttribute('x'));
                const y = parseFloat(rect.getAttribute('y'));
                dragOffset = {
                    x: pos.x - x,
                    y: pos.y - y
                };
            } else {
                const bounds = clickedElement.getBBox();
                dragOffset = {
                    x: pos.x - snapToGrid(bounds.x),
                    y: pos.y - snapToGrid(bounds.y)
                };
            }
        } else {
            deselectElement();
        }
    } else if (currentTool === 'rectangle') {
        isDrawing = true;
        startPoint = pos;
        currentShape = createRectangle(pos.x, pos.y, 0, 0);
        drawingLayer.appendChild(currentShape);
    } else if (currentTool === 'text') {
        createText(pos.x, pos.y);
    } else if (currentTool === 'arrow') {
        isDrawing = true;
        startPoint = pos;
        // Create arrow with zero length initially
        currentShape = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        currentShape.setAttribute('x1', pos.x);
        currentShape.setAttribute('y1', pos.y);
        currentShape.setAttribute('x2', pos.x);
        currentShape.setAttribute('y2', pos.y);
        currentShape.setAttribute('stroke', strokeColorInput.value);
        currentShape.setAttribute('stroke-width', strokeWidthInput.value);
        currentShape.setAttribute('marker-end', 'url(#arrowhead)');
        currentShape.setAttribute('data-shape', 'arrow');
        currentShape.style.cursor = 'move';
        drawingLayer.appendChild(currentShape);
    }
}

function handleMouseMove(event) {
    const pos = getMousePosition(event);

    if (isDragging && selectedElement) {
        moveElement(selectedElement, pos.x - dragOffset.x, pos.y - dragOffset.y);
    } else if (isDrawing && currentTool === 'rectangle' && currentShape) {
        const width = snapToGrid(Math.abs(pos.x - startPoint.x));
        const height = snapToGrid(Math.abs(pos.y - startPoint.y));
        const x = pos.x < startPoint.x ? pos.x : startPoint.x;
        const y = pos.y < startPoint.y ? pos.y : startPoint.y;

        // currentShape is a group, update the rect inside it
        const rect = currentShape.querySelector('.main-rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);

        // Update edge zones
        const edgeWidth = 10;
        currentShape.querySelector('.edge-top').setAttribute('x', x);
        currentShape.querySelector('.edge-top').setAttribute('y', y - edgeWidth/2);
        currentShape.querySelector('.edge-top').setAttribute('width', width);
        currentShape.querySelector('.edge-bottom').setAttribute('x', x);
        currentShape.querySelector('.edge-bottom').setAttribute('y', y + height - edgeWidth/2);
        currentShape.querySelector('.edge-bottom').setAttribute('width', width);
        currentShape.querySelector('.edge-left').setAttribute('x', x - edgeWidth/2);
        currentShape.querySelector('.edge-left').setAttribute('y', y);
        currentShape.querySelector('.edge-left').setAttribute('height', height);
        currentShape.querySelector('.edge-right').setAttribute('x', x + width - edgeWidth/2);
        currentShape.querySelector('.edge-right').setAttribute('y', y);
        currentShape.querySelector('.edge-right').setAttribute('height', height);

        // Show size indicators on edges
        let widthIndicator = document.getElementById('widthIndicator');
        let heightIndicator = document.getElementById('heightIndicator');

        if (!widthIndicator) {
            widthIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            widthIndicator.setAttribute('id', 'widthIndicator');
            widthIndicator.setAttribute('fill', '#1976d2');
            widthIndicator.setAttribute('font-size', '12');
            widthIndicator.setAttribute('font-weight', 'bold');
            widthIndicator.setAttribute('text-anchor', 'middle');
            widthIndicator.style.pointerEvents = 'none';
            drawingLayer.appendChild(widthIndicator);
        }

        if (!heightIndicator) {
            heightIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            heightIndicator.setAttribute('id', 'heightIndicator');
            heightIndicator.setAttribute('fill', '#1976d2');
            heightIndicator.setAttribute('font-size', '12');
            heightIndicator.setAttribute('font-weight', 'bold');
            heightIndicator.setAttribute('text-anchor', 'middle');
            heightIndicator.style.pointerEvents = 'none';
            drawingLayer.appendChild(heightIndicator);
        }

        // Position width on top or bottom edge (centered)
        const widthX = x + width / 2;
        const widthY = pos.y > startPoint.y ? y - 5 : y + height + 15;
        widthIndicator.setAttribute('x', widthX);
        widthIndicator.setAttribute('y', widthY);
        widthIndicator.textContent = width;

        // Position height on left or right edge (centered)
        const heightX = pos.x > startPoint.x ? x - 15 : x + width + 15;
        const heightY = y + height / 2 + 5;
        heightIndicator.setAttribute('x', heightX);
        heightIndicator.setAttribute('y', heightY);
        heightIndicator.textContent = height;
    } else if (isDrawing && currentTool === 'arrow' && currentShape) {
        // Update arrow endpoint as user drags
        currentShape.setAttribute('x2', pos.x);
        currentShape.setAttribute('y2', pos.y);
    } else if (isResizingEdge && selectedElement && selectedEdge) {
        // Resize rectangle by dragging edge
        resizeRectangleEdge(selectedElement, selectedEdge, pos);
    }
}

function resizeRectangleEdge(rectGroup, edge, pos) {
    const rect = rectGroup.querySelector('.main-rect');
    let x = parseFloat(rect.getAttribute('x'));
    let y = parseFloat(rect.getAttribute('y'));
    let width = parseFloat(rect.getAttribute('width'));
    let height = parseFloat(rect.getAttribute('height'));

    const snappedX = snapToGrid(pos.x);
    const snappedY = snapToGrid(pos.y);

    if (edge === 'top') {
        const newY = snappedY;
        const newHeight = (y + height) - newY;
        if (newHeight >= GRID_SIZE) {
            y = newY;
            height = newHeight;
        }
    } else if (edge === 'bottom') {
        const newHeight = snappedY - y;
        if (newHeight >= GRID_SIZE) {
            height = newHeight;
        }
    } else if (edge === 'left') {
        const newX = snappedX;
        const newWidth = (x + width) - newX;
        if (newWidth >= GRID_SIZE) {
            x = newX;
            width = newWidth;
        }
    } else if (edge === 'right') {
        const newWidth = snappedX - x;
        if (newWidth >= GRID_SIZE) {
            width = newWidth;
        }
    }

    // Update rectangle
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);

    // Update edge zones
    const edgeWidth = 10;
    const topZone = rectGroup.querySelector('.edge-top');
    const bottomZone = rectGroup.querySelector('.edge-bottom');
    const leftZone = rectGroup.querySelector('.edge-left');
    const rightZone = rectGroup.querySelector('.edge-right');

    topZone.setAttribute('x', x);
    topZone.setAttribute('y', y - edgeWidth/2);
    topZone.setAttribute('width', width);

    bottomZone.setAttribute('x', x);
    bottomZone.setAttribute('y', y + height - edgeWidth/2);
    bottomZone.setAttribute('width', width);

    leftZone.setAttribute('x', x - edgeWidth/2);
    leftZone.setAttribute('y', y);
    leftZone.setAttribute('height', height);

    rightZone.setAttribute('x', x + width - edgeWidth/2);
    rightZone.setAttribute('y', y);
    rightZone.setAttribute('height', height);

    // Update edge texts
    updateRectangleEdgeTexts(rectGroup);
}

function handleMouseUp(event) {
    if (isDrawing && currentTool === 'rectangle' && currentShape) {
        // currentShape is a group, check the rect inside it
        const rect = currentShape.querySelector('.main-rect');
        const width = parseInt(rect.getAttribute('width'));
        const height = parseInt(rect.getAttribute('height'));

        if (width < GRID_SIZE || height < GRID_SIZE) {
            currentShape.remove();
        } else {
            shapes.push(currentShape);
            // Return to select mode after creating rectangle
            document.getElementById('selectTool').click();
        }

        // Remove size indicators
        const widthIndicator = document.getElementById('widthIndicator');
        const heightIndicator = document.getElementById('heightIndicator');
        if (widthIndicator) widthIndicator.remove();
        if (heightIndicator) heightIndicator.remove();
    } else if (isDrawing && currentTool === 'arrow' && currentShape) {
        const x1 = parseFloat(currentShape.getAttribute('x1'));
        const y1 = parseFloat(currentShape.getAttribute('y1'));
        const x2 = parseFloat(currentShape.getAttribute('x2'));
        const y2 = parseFloat(currentShape.getAttribute('y2'));

        // Check if arrow has minimum length
        const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        if (length < GRID_SIZE) {
            currentShape.remove();
        } else {
            shapes.push(currentShape);
            // Return to select mode after creating arrow
            document.getElementById('selectTool').click();
        }
    }

    isDrawing = false;
    isDragging = false;
    isResizingEdge = false;
    currentShape = null;
}

function createRectangle(x, y, width, height) {
    // Create group to hold rectangle and edges
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-shape', 'rectangle-group');

    // Main rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('fill', fillColorInput.value);
    rect.setAttribute('stroke', strokeColorInput.value);
    rect.setAttribute('stroke-width', strokeWidthInput.value);
    rect.setAttribute('class', 'main-rect');

    // Store edge text data
    group.setAttribute('data-top-text', '');
    group.setAttribute('data-bottom-text', '');
    group.setAttribute('data-left-text', '');
    group.setAttribute('data-right-text', '');

    group.appendChild(rect);

    // Create edge hit zones (invisible)
    const edgeWidth = 10;
    createEdgeZone(group, 'top', x, y - edgeWidth/2, width, edgeWidth);
    createEdgeZone(group, 'bottom', x, y + height - edgeWidth/2, width, edgeWidth);
    createEdgeZone(group, 'left', x - edgeWidth/2, y, edgeWidth, height);
    createEdgeZone(group, 'right', x + width - edgeWidth/2, y, edgeWidth, height);

    // Create text elements for each edge
    updateRectangleEdgeTexts(group);

    return group;
}

function createEdgeZone(group, edge, x, y, width, height) {
    const zone = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    zone.setAttribute('x', x);
    zone.setAttribute('y', y);
    zone.setAttribute('width', width);
    zone.setAttribute('height', height);
    zone.setAttribute('fill', 'transparent');
    zone.setAttribute('stroke', 'none');
    zone.setAttribute('class', `edge-zone edge-${edge}`);
    zone.setAttribute('data-edge', edge);
    zone.style.cursor = edge === 'top' || edge === 'bottom' ? 'ns-resize' : 'ew-resize';
    group.appendChild(zone);
}

function updateRectangleEdgeTexts(group) {
    const rect = group.querySelector('.main-rect');
    const x = parseFloat(rect.getAttribute('x'));
    const y = parseFloat(rect.getAttribute('y'));
    const width = parseFloat(rect.getAttribute('width'));
    const height = parseFloat(rect.getAttribute('height'));

    const texts = {
        top: group.getAttribute('data-top-text'),
        bottom: group.getAttribute('data-bottom-text'),
        left: group.getAttribute('data-left-text'),
        right: group.getAttribute('data-right-text')
    };

    // Remove old text elements
    group.querySelectorAll('.edge-text').forEach(t => t.remove());

    // Add new text elements
    if (texts.top) {
        const text = createEdgeText(x + width/2, y - 5, texts.top, 'middle');
        text.setAttribute('class', 'edge-text edge-text-top');
        group.appendChild(text);
    }
    if (texts.bottom) {
        const text = createEdgeText(x + width/2, y + height + 15, texts.bottom, 'middle');
        text.setAttribute('class', 'edge-text edge-text-bottom');
        group.appendChild(text);
    }
    if (texts.left) {
        const text = createEdgeText(x - 5, y + height/2 + 5, texts.left, 'end');
        text.setAttribute('class', 'edge-text edge-text-left');
        group.appendChild(text);
    }
    if (texts.right) {
        const text = createEdgeText(x + width + 5, y + height/2 + 5, texts.right, 'start');
        text.setAttribute('class', 'edge-text edge-text-right');
        group.appendChild(text);
    }
}

function createEdgeText(x, y, content, anchor) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('text-anchor', anchor);
    text.setAttribute('fill', '#1976d2');
    text.setAttribute('font-size', '12');
    text.style.pointerEvents = 'none';
    text.textContent = content;
    return text;
}

function handleDoubleClick(event) {
    const clickedElement = event.target.closest('[data-shape]');
    if (clickedElement && clickedElement.getAttribute('data-shape') === 'rectangle') {
        editRectangleText(clickedElement);
    }
}

function editRectangleText(rect) {
    const x = parseFloat(rect.getAttribute('x'));
    const y = parseFloat(rect.getAttribute('y'));
    const width = parseFloat(rect.getAttribute('width'));
    const height = parseFloat(rect.getAttribute('height'));
    const currentText = rect.getAttribute('data-text') || '';

    // Create foreignObject for input
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('x', x);
    foreignObject.setAttribute('y', y + height / 2 - 15);
    foreignObject.setAttribute('width', width);
    foreignObject.setAttribute('height', '30');
    foreignObject.setAttribute('id', 'rectTextEdit');

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.style.width = '100%';
    input.style.fontSize = '14px';
    input.style.border = '1px solid #1976d2';
    input.style.padding = '4px';
    input.style.textAlign = 'center';
    input.style.background = 'white';

    input.addEventListener('blur', () => {
        const textValue = input.value.trim();
        rect.setAttribute('data-text', textValue);
        updateRectangleText(rect);
        foreignObject.remove();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape') {
            foreignObject.remove();
        }
    });

    foreignObject.appendChild(input);
    drawingLayer.appendChild(foreignObject);

    setTimeout(() => {
        input.focus();
        input.select();
    }, 0);
}

function updateRectangleText(rect) {
    const text = rect.getAttribute('data-text');
    const x = parseFloat(rect.getAttribute('x'));
    const y = parseFloat(rect.getAttribute('y'));
    const width = parseFloat(rect.getAttribute('width'));
    const height = parseFloat(rect.getAttribute('height'));

    // Remove existing text if any
    const existingText = rect.nextElementSibling;
    if (existingText && existingText.getAttribute('data-rect-text')) {
        existingText.remove();
    }

    // Add new text if not empty
    if (text) {
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('x', x + width / 2);
        textEl.setAttribute('y', y + height / 2 + 5);
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('fill', strokeColorInput.value);
        textEl.setAttribute('font-size', '14');
        textEl.setAttribute('data-rect-text', 'true');
        textEl.setAttribute('data-parent-rect', shapes.indexOf(rect));
        textEl.style.pointerEvents = 'none';
        textEl.textContent = text;

        rect.parentNode.insertBefore(textEl, rect.nextSibling);
    }
}

function createText(x, y) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('fill', strokeColorInput.value);
    text.setAttribute('font-size', '16');
    text.setAttribute('font-family', 'Arial, sans-serif');
    text.setAttribute('data-shape', 'text');
    text.style.cursor = 'move';
    text.textContent = '';

    drawingLayer.appendChild(text);

    // Make text editable
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('x', x);
    foreignObject.setAttribute('y', y - 16);
    foreignObject.setAttribute('width', '200');
    foreignObject.setAttribute('height', '30');

    const input = document.createElement('input');
    input.type = 'text';
    input.value = '';
    input.placeholder = 'Enter text...';
    input.style.width = '100%';
    input.style.fontSize = '16px';
    input.style.border = '1px solid #1976d2';
    input.style.padding = '2px';
    input.style.fontFamily = 'Arial, sans-serif';

    input.addEventListener('blur', () => {
        const textValue = input.value.trim();
        if (textValue) {
            text.textContent = textValue;
            shapes.push(text);
        } else {
            // Remove text element if empty
            text.remove();
        }
        foreignObject.remove();
        // Return to select mode after creating text
        document.getElementById('selectTool').click();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape') {
            // Cancel text creation
            text.remove();
            foreignObject.remove();
            // Return to select mode on cancel
            document.getElementById('selectTool').click();
        }
    });

    foreignObject.appendChild(input);
    drawingLayer.appendChild(foreignObject);

    setTimeout(() => {
        input.focus();
        input.select();
    }, 0);
}

function createArrow(start, end) {
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    arrow.setAttribute('x1', start.x);
    arrow.setAttribute('y1', start.y);
    arrow.setAttribute('x2', end.x);
    arrow.setAttribute('y2', end.y);
    arrow.setAttribute('stroke', strokeColorInput.value);
    arrow.setAttribute('stroke-width', strokeWidthInput.value);
    arrow.setAttribute('marker-end', 'url(#arrowhead)');
    arrow.setAttribute('data-shape', 'arrow');
    arrow.style.cursor = 'move';

    // Check for shape anchoring
    const startShape = findShapeAtPoint(start.x, start.y);
    const endShape = findShapeAtPoint(end.x, end.y);

    if (startShape) {
        arrow.setAttribute('data-start-anchor', shapes.indexOf(startShape));
    }
    if (endShape) {
        arrow.setAttribute('data-end-anchor', shapes.indexOf(endShape));
    }

    drawingLayer.appendChild(arrow);
    shapes.push(arrow);
}

function findShapeAtPoint(x, y, tolerance = 30) {
    for (let shape of shapes) {
        if (shape.getAttribute('data-shape') === 'rectangle-group') {
            const rect = shape.querySelector('.main-rect');
            const rx = parseFloat(rect.getAttribute('x'));
            const ry = parseFloat(rect.getAttribute('y'));
            const rw = parseFloat(rect.getAttribute('width'));
            const rh = parseFloat(rect.getAttribute('height'));

            if (x >= rx - tolerance && x <= rx + rw + tolerance &&
                y >= ry - tolerance && y <= ry + rh + tolerance) {
                return shape;
            }
        }
    }
    return null;
}

function selectElement(element) {
    deselectElement();
    selectedElement = element;
    element.style.filter = 'drop-shadow(0 0 4px rgba(25, 118, 210, 0.8))';

    // Show rotation control for text elements
    const rotationControl = document.getElementById('rotationControl');
    const textRotationInput = document.getElementById('textRotation');
    const textRotationValue = document.getElementById('textRotationValue');

    if (element.getAttribute('data-shape') === 'text') {
        rotationControl.style.display = 'flex';
        const currentRotation = element.getAttribute('data-rotation') || '0';
        textRotationInput.value = currentRotation;
        textRotationValue.textContent = currentRotation + '°';
    } else {
        rotationControl.style.display = 'none';
    }
}

function deselectElement() {
    if (selectedElement) {
        selectedElement.style.filter = '';
        selectedElement = null;
    }
    selectedEdge = null;

    // Hide rotation control
    const rotationControl = document.getElementById('rotationControl');
    rotationControl.style.display = 'none';

    // Remove edge highlight
    document.querySelectorAll('.edge-zone').forEach(z => z.style.stroke = 'none');
}

function selectEdge(rectGroup, edge) {
    deselectElement();
    selectedElement = rectGroup;
    selectedEdge = edge;

    // Highlight selected edge
    const edgeZone = rectGroup.querySelector(`.edge-${edge}`);
    if (edgeZone) {
        edgeZone.style.stroke = '#1976d2';
        edgeZone.style.strokeWidth = '2';
    }
}

// Keyboard event for typing on selected edge
document.addEventListener('keypress', (e) => {
    if (selectedEdge && selectedElement) {
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            // Show input field on first keypress
            if (!document.getElementById('edgeTextInput')) {
                showEdgeTextInput(selectedElement, selectedEdge);
            }
        }
    }
});

function showEdgeTextInput(rectGroup, edge) {
    // Remove any existing input
    const existing = document.getElementById('edgeTextInput');
    if (existing) existing.remove();

    const rect = rectGroup.querySelector('.main-rect');
    const x = parseFloat(rect.getAttribute('x'));
    const y = parseFloat(rect.getAttribute('y'));
    const width = parseFloat(rect.getAttribute('width'));
    const height = parseFloat(rect.getAttribute('height'));

    const attrName = `data-${edge}-text`;
    const currentText = rectGroup.getAttribute(attrName) || '';

    // Create foreignObject for input
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('id', 'edgeTextInput');

    let inputX, inputY, inputWidth;
    if (edge === 'top') {
        inputX = x;
        inputY = y - 25;
        inputWidth = width;
    } else if (edge === 'bottom') {
        inputX = x;
        inputY = y + height + 5;
        inputWidth = width;
    } else if (edge === 'left') {
        inputX = x - 100;
        inputY = y + height/2 - 15;
        inputWidth = 95;
    } else {
        inputX = x + width + 5;
        inputY = y + height/2 - 15;
        inputWidth = 95;
    }

    foreignObject.setAttribute('x', inputX);
    foreignObject.setAttribute('y', inputY);
    foreignObject.setAttribute('width', inputWidth);
    foreignObject.setAttribute('height', '30');

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.style.width = '100%';
    input.style.fontSize = '12px';
    input.style.border = '2px solid #1976d2';
    input.style.padding = '4px';
    input.style.background = 'white';
    input.style.textAlign = edge === 'top' || edge === 'bottom' ? 'center' : 'left';

    input.addEventListener('input', (e) => {
        rectGroup.setAttribute(attrName, e.target.value);
        updateRectangleEdgeTexts(rectGroup);
    });

    input.addEventListener('blur', () => {
        foreignObject.remove();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
            input.blur();
        }
    });

    foreignObject.appendChild(input);
    drawingLayer.appendChild(foreignObject);

    setTimeout(() => {
        input.focus();
        input.setSelectionRange(currentText.length, currentText.length);
    }, 0);
}

function moveElement(element, x, y) {
    const type = element.getAttribute('data-shape');

    if (type === 'rectangle') {
        element.setAttribute('x', x);
        element.setAttribute('y', y);
    } else if (type === 'text') {
        element.setAttribute('x', x);
        element.setAttribute('y', y);
    } else if (type === 'rectangle-group') {
        const rect = element.querySelector('.main-rect');
        const oldX = parseFloat(rect.getAttribute('x'));
        const oldY = parseFloat(rect.getAttribute('y'));
        const width = parseFloat(rect.getAttribute('width'));
        const height = parseFloat(rect.getAttribute('height'));

        rect.setAttribute('x', x);
        rect.setAttribute('y', y);

        // Update edge zones
        const edgeWidth = 10;
        element.querySelector('.edge-top').setAttribute('x', x);
        element.querySelector('.edge-top').setAttribute('y', y - edgeWidth/2);
        element.querySelector('.edge-bottom').setAttribute('x', x);
        element.querySelector('.edge-bottom').setAttribute('y', y + height - edgeWidth/2);
        element.querySelector('.edge-left').setAttribute('x', x - edgeWidth/2);
        element.querySelector('.edge-left').setAttribute('y', y);
        element.querySelector('.edge-right').setAttribute('x', x + width - edgeWidth/2);
        element.querySelector('.edge-right').setAttribute('y', y);

        updateRectangleEdgeTexts(element);

        // Update anchored arrows
        updateAnchoredArrows(element);
    } else if (type === 'arrow') {
        const x1 = parseFloat(element.getAttribute('x1'));
        const y1 = parseFloat(element.getAttribute('y1'));
        const x2 = parseFloat(element.getAttribute('x2'));
        const y2 = parseFloat(element.getAttribute('y2'));

        const dx = x2 - x1;
        const dy = y2 - y1;

        const snappedX = snapToGrid(x);
        const snappedY = snapToGrid(y);

        element.setAttribute('x1', snappedX);
        element.setAttribute('y1', snappedY);
        element.setAttribute('x2', snappedX + dx);
        element.setAttribute('y2', snappedY + dy);
    }
}

function updateAnchoredArrows(movedShape) {
    const shapeIndex = shapes.indexOf(movedShape);
    if (shapeIndex === -1) return;

    const rect = movedShape.querySelector('.main-rect');
    const x = parseFloat(rect.getAttribute('x'));
    const y = parseFloat(rect.getAttribute('y'));
    const width = parseFloat(rect.getAttribute('width'));
    const height = parseFloat(rect.getAttribute('height'));
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    shapes.forEach(shape => {
        if (shape.getAttribute('data-shape') === 'arrow') {
            const startAnchor = shape.getAttribute('data-start-anchor');
            const endAnchor = shape.getAttribute('data-end-anchor');

            if (startAnchor === shapeIndex.toString()) {
                shape.setAttribute('x1', centerX);
                shape.setAttribute('y1', centerY);
            }
            if (endAnchor === shapeIndex.toString()) {
                shape.setAttribute('x2', centerX);
                shape.setAttribute('y2', centerY);
            }
        }
    });
}

function deleteSelected() {
    if (selectedElement) {
        const index = shapes.indexOf(selectedElement);
        if (index > -1) {
            shapes.splice(index, 1);
        }
        selectedElement.remove();
        selectedElement = null;
    }
}

function clearAll() {
    if (confirm('Clear all shapes? This cannot be undone.')) {
        shapes.forEach(shape => shape.remove());
        shapes = [];
        selectedElement = null;
        arrowStart = null;
        const dot = document.getElementById('arrowStartDot');
        if (dot) dot.remove();
    }
}

// Action buttons
document.getElementById('deleteBtn').addEventListener('click', deleteSelected);
document.getElementById('clearBtn').addEventListener('click', clearAll);

// Update arrow marker color when stroke color changes
strokeColorInput.addEventListener('input', (e) => {
    const marker = document.querySelector('#arrowhead polygon');
    if (marker) {
        marker.setAttribute('fill', e.target.value);
    }
});
