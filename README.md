# PixelPinch Image Optimizer API

A fast and efficient RESTful API built with Node.js and Express that allows users to upload, format, compress, and resize images on the fly. It utilizes the high-performance [Sharp](https://sharp.pixelplumbing.com/) library for image processing.

## Features

- **Format Conversion**: Convert images to `jpeg`, `png`, `webp`, or `avif`.
- **Compression**: Adjust image quality to reduce file size and save bandwidth.
- **Resizing**: Dynamically scale images by providing width and/or height while maintaining aspect ratios (`fit: inside`).
- **Security Safeguards**: Includes file size limits (max 10MB) and strict mimetype validation to only accept image files.
- **Analytics**: Provides `X-Original-Size` and `X-Optimized-Size` headers in the response to track optimization savings.
- **Logging & Metrics**: Logs all incoming requests to a local `.log` file and tracks total API usage.

## Prerequisites

- Node.js (v18.17.0 or higher is recommended for the `sharp` dependency)
- npm

## Installation

1. Clone the repository or navigate to the project directory:

   ```bash
   cd image-optimizer-api
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

## Running the Server

Start the development server:

```bash
npm start
```

The server will start on `http://localhost:3000` (or the port defined in your `PORT` environment variable).

## Running Tests

This project uses **Jest** and **Supertest** for testing. To run the test suite:

```bash
npm test
```

_(Note: Ensure you have a `test-image.jpeg` in your root directory before running tests as expected by the test suite)._

## API Documentation

### `POST /optimize`

Processes an uploaded image based on the provided form-data parameters.

**Request Type:** `multipart/form-data`

| Parameter | Type   | Required | Default | Description                                               |
| :-------- | :----- | :------- | :------ | :-------------------------------------------------------- |
| `image`   | File   | **Yes**  | -       | The image file to be optimized (Max size: 10MB).          |
| `format`  | String | No       | `webp`  | The target output format (`jpeg`, `png`, `webp`, `avif`). |
| `quality` | Number | No       | `80`    | The compression quality level between `1` and `100`.      |
| `width`   | Number | No       | `null`  | The desired max width of the output image in pixels.      |
| `height`  | Number | No       | `null`  | The desired max height of the output image in pixels.     |

#### Example Request (cURL)

```bash
curl -X POST http://localhost:3000/optimize \
  -F "image=@/path/to/your/image.jpg" \
  -F "format=webp" \
  -F "quality=75" \
  -F "width=800" \
  --output optimized-image.webp
```

#### Response Headers

The API returns the raw image buffer along with custom headers to track size savings:

- `X-Original-Size`: Size of the uploaded file in bytes.
- `X-Optimized-Size`: Size of the processed file in bytes.

### `GET /usage`

Retrieves the total number of times the `/optimize` endpoint has been used since the server was last started.

#### Example Request

```bash
curl http://localhost:3000/usage
```

#### Example Response

```json
{
  "totalOptimizations": 5
}
```
