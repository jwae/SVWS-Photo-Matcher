import pngToIco from 'png-to-ico'
import fs from 'fs'

const pngPath = 'build/icon.png'
const icoPath = 'build/icon.ico'

const buffer = await pngToIco(pngPath)
fs.writeFileSync(icoPath, buffer)

console.log('icon.ico erstellt ✔')
