import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'

/**
 * Pide una contraseña por terminal SIN mostrarla en pantalla.
 * Usa Node.js puro, sin dependencias externas.
 *
 * La técnica: un Writable stream que silencia el output durante el question(),
 * de manera que las teclas se leen pero no se reflejan en consola.
 */
export function pedirPassword(label: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let muted = false

    const muteStream = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) {
          process.stdout.write(chunk, encoding as BufferEncoding)
        }
        callback()
      },
    })

    const rl = createInterface({
      input: process.stdin,
      output: muteStream,
      terminal: true,
    })

    rl.question(label, (answer) => {
      rl.close()
      process.stdout.write('\n')
      if (!answer || answer.trim().length === 0) {
        reject(new Error('No se ingresó ninguna contraseña.'))
        return
      }
      resolve(answer)
    })

    // Activar el muteo justo después de imprimir el label
    muted = true
  })
}
