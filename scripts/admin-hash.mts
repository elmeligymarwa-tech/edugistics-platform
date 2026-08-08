import { hash } from '@node-rs/argon2'
import * as readline from 'node:readline'

interface MutableInterface {
  output: NodeJS.WritableStream
  _writeToOutput: (data: string) => void
}

function promptHiddenPassword(label: string): Promise<string> {
  return new Promise((resolve) => {
    process.stderr.write(label)
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const mutableRl = rl as unknown as MutableInterface
    let muted = false
    mutableRl._writeToOutput = (data: string) => {
      if (!muted) mutableRl.output.write(data)
    }
    rl.question('', (answer) => {
      rl.close()
      process.stderr.write('\n')
      resolve(answer.trim())
    })
    muted = true
  })
}

async function main(): Promise<void> {
  const password = await promptHiddenPassword('Admin password: ')
  if (!password) {
    process.stderr.write('No password entered.\n')
    process.exitCode = 1
    return
  }
  const hashed = await hash(password)
  process.stdout.write(`${hashed}\n`)
}

void main()
