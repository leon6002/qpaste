# QPaste

QPaste is a powerful, lightweight screen capture and annotation tool built with Tauri, React, and Rust. It allows you to quickly capture screenshots, annotate them with various tools, and copy or save the results.

## Features

*   **Global Shortcut**: Press `F1` to toggle the screenshot interface.
*   **Multi-Monitor Support**: Seamlessly captures all connected monitors.
*   **Annotation Tools**:
    *   **Rectangle**: Draw rectangles to highlight areas.
    *   **Arrow**: Point out specific details.
    *   **Text**: Add text annotations with customizable font size and color.
*   **Selection**: Drag to select a specific area to copy or save.
*   **Clipboard Integration**: Copy the selected area directly to your clipboard.
*   **Save to Disk**: Save the selected area as a PNG file.
*   **Undo**: Undo your last annotation action.
*   **Customization**: Choose from a palette of colors and adjust font sizes.
*   **Cross-Platform**: Built on Tauri for a small footprint and high performance.

## Tech Stack

*   **Frontend**: React, TypeScript, Vite, Zustand (State Management), React-Konva (Canvas)
*   **Backend**: Rust, Tauri
*   **Styling**: CSS Modules / Vanilla CSS

## Development

### Prerequisites

*   Node.js (pnpm recommended)
*   Rust (Cargo)

### Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/leon6002/qpaste.git
    cd qpaste
    ```

2.  Install dependencies:
    ```bash
    pnpm install
    ```

3.  Run the development server:
    ```bash
    pnpm tauri dev
    ```

4.  Build the application:
    ```bash
    pnpm tauri build
    ```

## Usage

1.  Run the application.
2.  Press `F1` to open the screenshot overlay.
3.  Use the toolbar to select tools (Rectangle, Arrow, Text).
4.  Draw on the screen.
5.  Use the "Select" tool to drag a selection box around the area you want to capture.
6.  Click "Copy" to copy to clipboard or "Save" to save to a file.
7.  Press `Esc` or click the Close button to exit.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
