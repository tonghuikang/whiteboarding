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
- Creation non-text object should drag-create, not double click-create
    - When creating the size of the object the user will mouse-down
    - Releasing the mouse will create the object
- Copy command will copy the object
- Paste command will paste the object

Requirements for arrow
- When creating the arrow, each rectangle will show 8 points to snap to
    - The 8 points are
        - The four corners
        - The middle of each edge

Requirements for rectangle
- When creating the object
    - The size will be shown on each of the opposite edge
        - e.g. The bottom-right corner is being decided
            - The length will be shown on the top edge (because it is opposite)
            - The width will be shown on the left edge (because it is opposite)
        - e.g. The top-left corner is being decided
            - The length will be shown on the bottom edge (because it is opposite)
            - The width will be shown on the right edge (because it is opposite)
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
- When the recentage is moved / resized
    - The connecting arrows will also follow the rectangle
