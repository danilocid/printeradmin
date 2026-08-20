# Print Server for Raspberry Pi

A NestJS-based print server for local network use, designed to run on Raspberry Pi with Docker.

## Architecture

```
Cliente
  ↓ HTTP
Print Server
  ↓
Printer Driver
  ↓
USB
  ↓
Printer
```

## Features

- REST API for printer management
- Support for BIXOLON SRP-E300 (receipt printer)
- Support for XPrinter XP-420B (label printer)
- PDF printing support
- Job queue system
- API Key authentication
- Swagger documentation

## Requirements

- Raspberry Pi (ARM64)
- Linux (Raspberry Pi OS)
- Docker
- Portainer (optional, for management)
- USB printers connected

## USB Device Identification

To identify connected USB printers:

```bash
# List USB devices
lsusb

# Check printer devices
ls -l /dev/usb/

# Check kernel messages
dmesg | tail
```

## Development

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev

# Run tests
npm test

# Build for production
npm run build
```

### Docker Development

```bash
# Build image
docker build -t print-server .

# Run container
docker run -p 8080:8080 \
  -v /dev/usb/lp0:/dev/usb/lp0 \
  -e API_KEY=your-api-key \
  print-server
```

## Production Deployment

### Docker Compose

```bash
# Set API key
export API_KEY=your-secure-api-key

# Start services
docker-compose up -d
```

### Portainer

1. Access Portainer web interface
2. Go to Stacks
3. Add Stack
4. Paste docker-compose.yml content
5. Deploy

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `API_KEY` | API authentication key | `change-me` |
| `BIXOLON_DEVICE` | Bixolon printer device path | `/dev/usb/lp0` |
| `BIXOLON_WIDTH` | Bixolon print width (pixels) | `576` |
| `XPRINTER_DEVICE` | XPrinter printer device path | `/dev/usb/lp1` |
| `XPRINTER_WIDTH` | XPrinter print width (pixels) | `400` |
| `XPRINTER_HEIGHT` | XPrinter print height (pixels) | `300` |
| `XPRINTER_DPI` | XPrinter DPI | `203` |
| `MAX_PDF_SIZE_MB` | Maximum PDF file size (MB) | `10` |

## API Documentation

Access Swagger documentation at:

```
http://RASPBERRY_IP:8080/api
```

## API Endpoints

### Health Check

```http
GET /health
```

Response:
```json
{
  "status": "ok"
}
```

### List Printers

```http
GET /printers
X-API-Key: your-api-key
```

Response:
```json
{
  "printers": [
    {
      "id": "bixolon",
      "name": "BIXOLON SRP-E300",
      "type": "receipt"
    },
    {
      "id": "xprinter",
      "name": "XPrinter XP-420B",
      "type": "label"
    }
  ]
}
```

### Get Printer Status

```http
GET /printers/:printerId/status
X-API-Key: your-api-key
```

Response:
```json
{
  "printer": "bixolon",
  "status": "ready"
}
```

### Print Raw Data

```http
POST /printers/:printerId/raw
X-API-Key: your-api-key
Content-Type: application/json

{
  "data": "486f6c61204d756e646f"
}
```

### Print Ticket (Bixolon)

```http
POST /printers/bixolon/ticket
X-API-Key: your-api-key
Content-Type: application/json

{
  "title": "MI TIENDA",
  "subtitle": "Venta #1234",
  "items": [
    {
      "name": "Producto A",
      "quantity": 2,
      "price": 3990
    }
  ],
  "total": 7980
}
```

### Print PDF (Bixolon)

```http
POST /printers/bixolon/pdf
X-API-Key: your-api-key
Content-Type: multipart/form-data

file: <PDF_FILE>
```

### Print PDF (XPrinter)

```http
POST /printers/xprinter/pdf
X-API-Key: your-api-key
Content-Type: multipart/form-data

file: <PDF_FILE>
```

### Get Job Status

```http
GET /jobs/:jobId
X-API-Key: your-api-key
```

## Testing

### Unit Tests

```bash
npm test
```

### Test RAW Print

```bash
# Bixolon
curl -X POST http://localhost:8080/printers/bixolon/raw \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"data": "486f6c6120446573646520526173706265727279504922"}'

# XPrinter
curl -X POST http://localhost:8080/printers/xprinter/raw \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"data": "5a504c2048656c6c6f"}'
```

## PDF Printing

### BIXOLON (80mm receipts)

PDFs are converted to ESC/POS format:
```
PDF 80mm → bitmap → ESC/POS → BIXOLON
```

### XPrinter (Labels)

PDFs are converted to appropriate format:
```
PDF → bitmap → formato de etiqueta → XPrinter
```

## Troubleshooting

### Printer Not Found

1. Check USB connection: `lsusb`
2. Check device exists: `ls -l /dev/usb/`
3. Check permissions: `sudo chmod 666 /dev/usb/lp0`

### Docker USB Access

Ensure devices are mapped in docker-compose.yml:

```yaml
devices:
  - /dev/usb/lp0:/dev/usb/lp0
  - /dev/usb/lp1:/dev/usb/lp1
```

## License

MIT
