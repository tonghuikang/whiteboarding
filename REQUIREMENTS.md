# User Requirements

You will make a draw.io clone.
- You can refer to https://github.com/jgraph/drawio for a reference

You are required to implement ALL these features.
- Do not implement features that are not requested.

Key design features of draw.io
- Easy-to-use
    - Two clicks to create or edit anything
- Precise drawings (snap to grid)

Modes
- Select mode
- Create mode
    - After creating the object, you will automatically switch back to select mode

There are three types of objects that can be created
- Rectangles
- Arrows
- Text

Requirements for all objects
- Must snap to grid

Requirements for rectangle
- There are FIVE text fields for the rectangle
    - Middle
    - Top edge
    - Bottom edge
    - Left edge
    - Right edge
- When the whole rectangle is selected
    - Typing something edits the middle text field
- When an edge of the rectangle is selected
    - (This is done by selecting a rectangle and then an edge)
    - Typing something edits the corresponding text field
    - Dragging will resize the rectangle
- When a corner of the rectangle is selected
    - Dragging will resize the rectangle
- When creating / resizing the rectangle
    - The size will be shown on the two opposite edges

