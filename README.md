# mcp-youtube

This project is a TypeScript implementation of a Minimal Communication Protocol (MCP) server. It is designed to download YouTube videos and provides utilities for AI understanding of the content. Current feature scope includes metadata, and transcriptions.

## Transcript Format Notes

The transcripts extracted from YouTube videos use the original VTT (WebVTT) timestamp format and preserve YouTube's auto-generated caption structure. This means:

- Timestamps are in `HH:MM:SS.mmm` format (e.g., `"00:01:23.456"`)
- Some segments may contain overlapping or duplicated text due to YouTube's captioning system creating "bridging" segments
- This redundancy is intentionally preserved as it provides additional context and temporal precision that can be useful for LLM analysis
- File sizes may be larger due to this redundancy, but the extra data helps maintain the complete temporal flow of speech

## Project Structure

- `src/server.ts`: Main entry point for the MCP server. Initializes the server and listens for incoming connections.
- `src/types/index.ts`: Contains TypeScript interfaces and types for data structure definitions used in the server.
- `tsconfig.json`: TypeScript configuration file specifying compiler options.
- `package.json`: npm configuration file listing dependencies and scripts.
- `.vscode/launch.json`: Debugging configuration for the MCP server.
- `.vscode/tasks.json`: Defines tasks for building and running the server.

## Getting Started

### Prerequisites

- Node.js (version X.X.X or later)
- npm (version X.X.X or later)
- TypeScript (version X.X.X or later)

### Installation

1. Clone the repository:

   ```cmd
   git clone https://github.com/your-repo/mcp-server.git
   ```

2. Navigate to the project directory:

   ```cmd
   cd mcp-server
   ```

3. Install the dependencies:

   ```cmd
   npm install
   ```

### Running the Server

To start the MCP server, use the following command:

```cmd
npm start
```

### Debugging

To debug the server, open the `.vscode/launch.json` file and configure your debugging settings. You can start debugging by pressing F5 or using the debug panel in your editor.

### Tasks

You can run predefined tasks using the command palette (Ctrl+Shift+P) and selecting "Run Task". This allows you to build the TypeScript files or run the server easily.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.
