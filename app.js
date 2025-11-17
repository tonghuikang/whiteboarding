// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = window.innerWidth - 220;
canvas.height = window.innerHeight - 40;

// State management
let currentTool = 'select';
let shapes = [];
let isDrawing = false;
let startX, startY;
let selectedShape = null;
let dragOffset = { x: 0, y: 0 };
let resizeHandle = null;
let connectionStart = null;

// Style settings
let fillColor = '#e3f2fd';
let strokeColor = '#1976d2';
let strokeWidth = 2;

// Shape class
class Shape {
    constructor(type, x, y, width, height, options = {}) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.fillColor = options.fillColor || fillColor;
        this.strokeColor = options.strokeColor || strokeColor;
        this.strokeWidth = options.strokeWidth || strokeWidth;
        this.text = options.text || '';
        this.rotation = options.rotation || 0;

        // For lines and arrows
        this.x2 = options.x2 || x + width;
        this.y2 = options.y2 || y + height;

        // For connections
        this.startShape = options.startShape || null;
        this.endShape = options.endShape || null;
    }

    draw() {
        ctx.save();

        switch (this.type) {
            case 'rectangle':
                this.drawRectangle();
                break;
            case 'circle':
                this.drawCircle();
                break;
            case 'diamond':
                this.drawDiamond();
                break;
            case 'text':
                this.drawText();
                break;
            case 'line':
                this.drawLine();
                break;
            case 'arrow':
                this.drawArrow();
                break;
        }

        ctx.restore();
    }

    drawRectangle() {
        ctx.fillStyle = this.fillColor;
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        if (this.text) {
            this.drawShapeText();
        }
    }

    drawCircle() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const radiusX = Math.abs(this.width) / 2;
        const radiusY = Math.abs(this.height) / 2;

        ctx.fillStyle = this.fillColor;
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;

        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (this.text) {
            this.drawShapeText();
        }
    }

    drawDiamond() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        ctx.fillStyle = this.fillColor;
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;

        ctx.beginPath();
        ctx.moveTo(centerX, this.y);
        ctx.lineTo(this.x + this.width, centerY);
        ctx.lineTo(centerX, this.y + this.height);
        ctx.lineTo(this.x, centerY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (this.text) {
            this.drawShapeText();
        }
    }

    drawText() {
        ctx.fillStyle = this.strokeColor;
        ctx.font = '16px Arial';
        ctx.textBaseline = 'top';
        ctx.fillText(this.text || 'Double-click to edit', this.x, this.y);
    }

    drawLine() {
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();
    }

    drawArrow() {
        // Draw line
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(this.y2 - this.y, this.x2 - this.x);
        const headLength = 15;

        ctx.fillStyle = this.strokeColor;
        ctx.beginPath();
        ctx.moveTo(this.x2, this.y2);
        ctx.lineTo(
            this.x2 - headLength * Math.cos(angle - Math.PI / 6),
            this.y2 - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            this.x2 - headLength * Math.cos(angle + Math.PI / 6),
            this.y2 - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
    }

    drawShapeText() {
        ctx.fillStyle = '#000000';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        ctx.fillText(this.text, centerX, centerY);
    }

    contains(x, y) {
        if (this.type === 'line' || this.type === 'arrow') {
            // Check if point is near the line
            const distance = this.distanceToLine(x, y);
            return distance < 10;
        }

        return x >= this.x && x <= this.x + this.width &&
               y >= this.y && y <= this.y + this.height;
    }

    distanceToLine(x, y) {
        const A = x - this.x;
        const B = y - this.y;
        const C = this.x2 - this.x;
        const D = this.y2 - this.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = this.x;
            yy = this.y;
        } else if (param > 1) {
            xx = this.x2;
            yy = this.y2;
        } else {
            xx = this.x + param * C;
            yy = this.y + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getResizeHandle(x, y) {
        if (this.type === 'line' || this.type === 'arrow' || this.type === 'text') {
            return null;
        }

        const handles = [
            { name: 'nw', x: this.x, y: this.y },
            { name: 'ne', x: this.x + this.width, y: this.y },
            { name: 'sw', x: this.x, y: this.y + this.height },
            { name: 'se', x: this.x + this.width, y: this.y + this.height }
        ];

        for (let handle of handles) {
            const dist = Math.sqrt(Math.pow(x - handle.x, 2) + Math.pow(y - handle.y, 2));
            if (dist < 8) {
                return handle.name;
            }
        }

        return null;
    }

    drawSelection() {
        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        if (this.type === 'line' || this.type === 'arrow') {
            ctx.strokeRect(
                Math.min(this.x, this.x2) - 5,
                Math.min(this.y, this.y2) - 5,
                Math.abs(this.x2 - this.x) + 10,
                Math.abs(this.y2 - this.y) + 10
            );
        } else {
            ctx.strokeRect(this.x, this.y, this.width, this.height);

            // Draw resize handles
            const handles = [
                { x: this.x, y: this.y },
                { x: this.x + this.width, y: this.y },
                { x: this.x, y: this.y + this.height },
                { x: this.x + this.width, y: this.y + this.height }
            ];

            ctx.fillStyle = '#1976d2';
            ctx.setLineDash([]);

            for (let handle of handles) {
                ctx.fillRect(handle.x - 4, handle.y - 4, 8, 8);
            }
        }

        ctx.setLineDash([]);
    }
}

// Draw all shapes
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all shapes
    shapes.forEach(shape => {
        shape.draw();
    });

    // Draw selection
    if (selectedShape) {
        selectedShape.drawSelection();
    }

    // Draw preview while drawing
    if (isDrawing && (currentTool !== 'select')) {
        drawPreview();
    }
}

function drawPreview() {
    const width = startX - canvas.offsetLeft;
    const height = startY - canvas.offsetTop;

    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = fillColor;
    ctx.lineWidth = strokeWidth;

    // This will be drawn in mousemove
    ctx.restore();
}

// Tool selection
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
        selectedShape = null;

        // Update cursor
        canvas.className = currentTool === 'select' ? 'select-mode' :
                          currentTool === 'text' ? 'text-mode' : 'drawing-mode';
        render();
    });
});

// Style controls
document.getElementById('fill-color').addEventListener('change', (e) => {
    fillColor = e.target.value;
    if (selectedShape && selectedShape.type !== 'line' && selectedShape.type !== 'arrow') {
        selectedShape.fillColor = fillColor;
        render();
    }
});

document.getElementById('stroke-color').addEventListener('change', (e) => {
    strokeColor = e.target.value;
    if (selectedShape) {
        selectedShape.strokeColor = strokeColor;
        render();
    }
});

document.getElementById('stroke-width').addEventListener('change', (e) => {
    strokeWidth = parseInt(e.target.value);
    if (selectedShape) {
        selectedShape.strokeWidth = strokeWidth;
        render();
    }
});

// Mouse events
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'select') {
        // Check for resize handle
        if (selectedShape) {
            resizeHandle = selectedShape.getResizeHandle(x, y);
            if (resizeHandle) {
                isDrawing = true;
                startX = x;
                startY = y;
                return;
            }
        }

        // Check for shape selection
        selectedShape = null;
        for (let i = shapes.length - 1; i >= 0; i--) {
            if (shapes[i].contains(x, y)) {
                selectedShape = shapes[i];
                dragOffset.x = x - selectedShape.x;
                dragOffset.y = y - selectedShape.y;
                isDrawing = true;
                break;
            }
        }
        render();
    } else if (currentTool === 'text') {
        const text = prompt('Enter text:');
        if (text !== null) {
            const shape = new Shape('text', x, y, 200, 30, { text });
            shapes.push(shape);
            render();
        }
    } else {
        isDrawing = true;
        startX = x;
        startY = y;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'select') {
        if (resizeHandle && selectedShape) {
            // Resize shape
            const dx = x - startX;
            const dy = y - startY;

            switch (resizeHandle) {
                case 'se':
                    selectedShape.width += dx;
                    selectedShape.height += dy;
                    break;
                case 'sw':
                    selectedShape.width -= dx;
                    selectedShape.height += dy;
                    selectedShape.x += dx;
                    break;
                case 'ne':
                    selectedShape.width += dx;
                    selectedShape.height -= dy;
                    selectedShape.y += dy;
                    break;
                case 'nw':
                    selectedShape.width -= dx;
                    selectedShape.height -= dy;
                    selectedShape.x += dx;
                    selectedShape.y += dy;
                    break;
            }

            startX = x;
            startY = y;
        } else if (selectedShape) {
            // Move shape
            if (selectedShape.type === 'line' || selectedShape.type === 'arrow') {
                const dx = x - (dragOffset.x + selectedShape.x);
                const dy = y - (dragOffset.y + selectedShape.y);
                selectedShape.x += dx;
                selectedShape.y += dy;
                selectedShape.x2 += dx;
                selectedShape.y2 += dy;
                dragOffset.x = x - selectedShape.x;
                dragOffset.y = y - selectedShape.y;
            } else {
                selectedShape.x = x - dragOffset.x;
                selectedShape.y = y - dragOffset.y;
            }
        }
        render();
    } else if (currentTool === 'line' || currentTool === 'arrow') {
        render();

        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
        ctx.stroke();

        if (currentTool === 'arrow') {
            const angle = Math.atan2(y - startY, x - startX);
            const headLength = 15;

            ctx.fillStyle = strokeColor;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(
                x - headLength * Math.cos(angle - Math.PI / 6),
                y - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                x - headLength * Math.cos(angle + Math.PI / 6),
                y - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    } else {
        render();

        const width = x - startX;
        const height = y - startY;

        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.fillStyle = fillColor;
        ctx.lineWidth = strokeWidth;
        ctx.setLineDash([5, 5]);

        if (currentTool === 'rectangle') {
            ctx.fillRect(startX, startY, width, height);
            ctx.strokeRect(startX, startY, width, height);
        } else if (currentTool === 'circle') {
            const centerX = startX + width / 2;
            const centerY = startY + height / 2;
            const radiusX = Math.abs(width) / 2;
            const radiusY = Math.abs(height) / 2;

            ctx.beginPath();
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else if (currentTool === 'diamond') {
            const centerX = startX + width / 2;
            const centerY = startY + height / 2;

            ctx.beginPath();
            ctx.moveTo(centerX, startY);
            ctx.lineTo(startX + width, centerY);
            ctx.lineTo(centerX, startY + height);
            ctx.lineTo(startX, centerY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool !== 'select' && currentTool !== 'text') {
        const width = x - startX;
        const height = y - startY;

        if (Math.abs(width) > 5 || Math.abs(height) > 5) {
            let shape;

            if (currentTool === 'line' || currentTool === 'arrow') {
                shape = new Shape(currentTool, startX, startY, 0, 0, {
                    x2: x,
                    y2: y
                });
            } else {
                shape = new Shape(currentTool, startX, startY, width, height);
            }

            shapes.push(shape);
        }
    }

    isDrawing = false;
    resizeHandle = null;
    render();
});

// Double-click to edit text
canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (let i = shapes.length - 1; i >= 0; i--) {
        if (shapes[i].contains(x, y)) {
            const newText = prompt('Enter text:', shapes[i].text || '');
            if (newText !== null) {
                shapes[i].text = newText;
                render();
            }
            break;
        }
    }
});

// Delete button
document.getElementById('delete-btn').addEventListener('click', () => {
    if (selectedShape) {
        const index = shapes.indexOf(selectedShape);
        if (index > -1) {
            shapes.splice(index, 1);
            selectedShape = null;
            render();
        }
    }
});

// Clear button
document.getElementById('clear-btn').addEventListener('click', () => {
    if (confirm('Clear all shapes?')) {
        shapes = [];
        selectedShape = null;
        render();
    }
});

// Save to JSON
document.getElementById('save-btn').addEventListener('click', () => {
    const data = JSON.stringify(shapes, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.json';
    a.click();
    URL.revokeObjectURL(url);
});

// Load from JSON
document.getElementById('load-btn').addEventListener('click', () => {
    document.getElementById('load-input').click();
});

document.getElementById('load-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                shapes = data.map(s => new Shape(s.type, s.x, s.y, s.width, s.height, s));
                selectedShape = null;
                render();
            } catch (error) {
                alert('Error loading file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
});

// Export to PNG
document.getElementById('export-png-btn').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'diagram.png';
    link.href = canvas.toDataURL();
    link.click();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedShape && e.target.tagName !== 'INPUT') {
            e.preventDefault();
            const index = shapes.indexOf(selectedShape);
            if (index > -1) {
                shapes.splice(index, 1);
                selectedShape = null;
                render();
            }
        }
    } else if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey) {
        document.querySelector('[data-tool="select"]').click();
    } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
        document.querySelector('[data-tool="rectangle"]').click();
    } else if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
        document.querySelector('[data-tool="circle"]').click();
    } else if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey) {
        document.querySelector('[data-tool="diamond"]').click();
    } else if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {
        document.querySelector('[data-tool="text"]').click();
    } else if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey) {
        document.querySelector('[data-tool="line"]').click();
    } else if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey) {
        document.querySelector('[data-tool="arrow"]').click();
    }
});

// Resize canvas on window resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth - 220;
    canvas.height = window.innerHeight - 40;
    render();
});

// Initial render
render();
