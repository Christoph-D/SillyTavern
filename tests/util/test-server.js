/**
 * A minimal Sillytavern API server that handles endpoints under /api/backends/chat-completions.
 */

import { router as chatCompletionsRouter } from "../../src/endpoints/backends/chat-completions.js";
import bodyParser from "body-parser";
import express from "express";

class TestServer {
    constructor() {
        /** @type {number} Port assigned by the OS; only valid after start(). */
        this.port = 0;
        this.server = null;
        this.app = null;
    }

    async start() {
        this.app = express();
        this.app.use(bodyParser.json());
        this.app.use("/api/backends/chat-completions", chatCompletionsRouter);
        return new Promise((resolve, reject) => {
            // The listen callback only fires on success and takes no error
            // argument, so failures must be captured via the 'error' event.
            this.server = this.app.listen(this.port, "127.0.0.1", () => {
                this.port = this.server.address().port;
                resolve();
            });
            this.server.once("error", reject);
        });
    }

    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.closeAllConnections();
                this.server.close(() => resolve());
            } else {
                resolve();
            }
        });
    }

    getBaseUrl() {
        return `http://127.0.0.1:${this.port}`;
    }
}

export { TestServer };
