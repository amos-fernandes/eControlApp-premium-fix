/*
  scripts/generate_qr.js
  Usage:
    npm install qrcode
    node scripts/generate_qr.js "https://testeaplicativo.econtrole.com/login?redirect_url=%2Foperacional%2Fviagens"

  This script generates an SVG QR file at `assets/qrcodes/testeaplicativo_login.svg`.
*/

const fs = require('fs')
const path = require('path')
const QRCode = require('qrcode')

async function generate(url) {
  const outDir = path.join(__dirname, '..', 'assets', 'qrcodes')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const fileName = 'testeaplicativo_login.svg'
  const outPath = path.join(outDir, fileName)

  try {
    const svgString = await QRCode.toString(url, { type: 'svg', width: 400 })
    fs.writeFileSync(outPath, svgString, 'utf8')
    console.log('QR SVG written to', outPath)
  } catch (err) {
    console.error('Failed to generate QR:', err)
    process.exit(1)
  }
}

const url = process.argv[2] || 'https://testeaplicativo.econtrole.com/login?redirect_url=%2Foperacional%2Fviagens'
generate(url)
