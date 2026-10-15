// Lanza Electron sin ELECTRON_RUN_AS_NODE (algunos terminales, como el de VS Code, lo definen)
import { spawn } from 'node:child_process'
import electron from 'electron'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electron, ['.'], { stdio: 'inherit', env })
child.on('close', (code) => process.exit(code ?? 0))
