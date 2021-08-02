#!/usr/bin/env node

const fs = require('fs')
const readline = require('readline')
const { EOL } = require('os')

// argv[0] = 'node'
// argv[1] = 'this_js_itself'
const infile = process.argv[2]

// Pass 1
const rl = readline.createInterface({
  input: fs.createReadStream(infile)
})

const outfile = infile.substring(0, infile.indexOf('.')) + '.hack'
const ws = fs.createWriteStream(outfile)

class Parser {
  hasMoreCommands () {
  // read next command is done by readStream and its event.
  // This method is just a place holder.
    return true
  }

  static advance (line) {
    const re = /\s+/
    const a = line.split(re)
    if (a[0] === '') {
      buf = a[1]
    } else {
      buf = a[0]
    }
  }

  static commandType () {
    if (buf === undefined) {
      return 'NO_COMMAND'
    }
    const c = buf[0]
    if (c === '@') {
      return 'A_COMMAND'
    } else if (c === '(') {
      return 'L_COMMAND'
    } else if (c === '0' || c === '1' || c === '-' || c === 'D' || c === 'A' || c === '!' || c === 'M') {
      return 'C_COMMAND'
    } else {
      return 'NO_COMMAND'
    }
  }

  static symbol () {
    if (this.commandType() === 'A_COMMAND') {
      const A = /(?<=@).*/
      return buf.match(A)
    } else if (this.commandType() === 'L_COMMAND') {
      const L = /(?<=\().*?(?=\))/
      return buf.match(L)
    } else {
      return null
    }
  }

  static dest () {
    if (buf.indexOf('=') > -1) {
      const destTokens = buf.split('=')
      return destTokens[0]
    }
  }

  static jump () {
    if (buf.indexOf(';') > -1) {
      const jumpTokens = buf.split(';')
      return jumpTokens.slice(-1)[0]
    }
  }

  static comp () {
    let start = buf.indexOf('=')
    if (start === -1) {
      start = 0
    } else {
      start++
    }
    let end = buf.indexOf(';')
    if (end === -1) {
      end = buf.length
    }
    return buf.slice(start, end)
  }
}

class Code {
  static dest (v) {
    if (v === 'M') return 1
    else if (v === 'D') return 2
    else if (v === 'MD') return 3
    else if (v === 'A') return 4
    else if (v === 'AM') return 5
    else if (v === 'AD') return 6
    else if (v === 'AMD') return 7
    else return 0
  }

  static jump (v) {
    if (v === 'JGT') return 1
    else if (v === 'JEQ') return 2
    else if (v === 'JGE') return 3
    else if (v === 'JLT') return 4
    else if (v === 'JNE') return 5
    else if (v === 'JLE') return 6
    else if (v === 'JMP') return 7
    else return 0
  }

  static comp (v) {
    if (v === '0') return parseInt('101010', 2)
    else if (v === '1') return parseInt('111111', 2)
    else if (v === '-1') return parseInt('111010', 2)
    else if (v === 'D') return parseInt('001100', 2)
    else if (v === 'A') return parseInt('110000', 2)
    else if (v === '!D') return parseInt('001101', 2)
    else if (v === '!A') return parseInt('110001', 2)
    else if (v === '-D') return parseInt('001111', 2)
    else if (v === '-A') return parseInt('110011', 2)
    else if (v === 'D+1') return parseInt('011111', 2)
    else if (v === 'A+1') return parseInt('110111', 2)
    else if (v === 'D-1') return parseInt('001110', 2)
    else if (v === 'A-1') return parseInt('110010', 2)
    else if (v === 'D+A') return parseInt('000010', 2)
    else if (v === 'D-A') return parseInt('010011', 2)
    else if (v === 'A-D') return parseInt('000111', 2)
    else if (v === 'D&A') return parseInt('000000', 2)
    else if (v === 'D|A') return parseInt('010101', 2)
    else if (v === 'M') return parseInt('1110000', 2)
    else if (v === '!M') return parseInt('1110001', 2)
    else if (v === '-M') return parseInt('1110011', 2)
    else if (v === 'M+1') return parseInt('1110111', 2)
    else if (v === 'M-1') return parseInt('1110010', 2)
    else if (v === 'D+M') return parseInt('1000010', 2)
    else if (v === 'D-M') return parseInt('1010011', 2)
    else if (v === 'M-D') return parseInt('1000111', 2)
    else if (v === 'D&M') return parseInt('1000000', 2)
    else if (v === 'D|M') return parseInt('1010101', 2)
  }
}

class SymbolTable {
  constructor () {
    this.table = {}
  }

  addEntry (symbol, address) {
    this.table[symbol] = address
  }

  contains (symbol) {
    if (this.table[symbol] === undefined) return false
    else return true
  }

  getAddress (symbol) {
    return this.table[symbol]
  }
}

// Global Variables
let buf
const symbolTable = new SymbolTable()

// default symbols
symbolTable.addEntry('SP', 0)
symbolTable.addEntry('LCL', 1)
symbolTable.addEntry('ARG', 2)
symbolTable.addEntry('THIS', 3)
symbolTable.addEntry('THAT', 4)
symbolTable.addEntry('SCREEN', 16384)
symbolTable.addEntry('KBD', 24576)
for (let i = 0; i < 16; i++) {
  symbolTable.addEntry('R' + i.toString(), i)
}

// Pass 1 : read src and build symbol table
let addr = 0
rl.on('line', (input) => {
  Parser.advance(input)
  const type = Parser.commandType()
  if (type === 'L_COMMAND') {
    symbolTable.addEntry(Parser.symbol(), addr)
  }
  if (type === 'A_COMMAND' || type === 'C_COMMAND') {
    addr++
  }
}).on('close', () => {
  // Pass 2 : assmemble
  // if A command with a symbol but not registered in symbol table,
  // It shoud be a variable starting from address 16.
  const rl2 = readline.createInterface({
    input: fs.createReadStream(infile)
  })

  addr = 16 // reset address to variable address
  rl2.on('line', (input) => {
    const zero = '0000000000000000'
    const prefix = parseInt('1110000000000000', 2)

    Parser.advance(input)
    const type = Parser.commandType()
    if (type === 'A_COMMAND') {
      let s = Parser.symbol()
      if (isNaN(s)) {
        if (symbolTable.contains(s)) {
          s = symbolTable.getAddress(s).toString(10)
        } else {
          symbolTable.addEntry(s, addr)
          s = addr.toString(10)
          addr++
        }
      }
      ws.write((zero + parseInt(s).toString(2)).slice(-16) + EOL)
    } else if (type === 'C_COMMAND') {
      const comp = Code.comp(Parser.comp()) * 64 // 6 bit shift
      const dest = Code.dest(Parser.dest()) * 8 // 3 bit shift
      const jump = Code.jump(Parser.jump())
      const code = prefix + comp + dest + jump
      ws.write((zero + parseInt(code).toString(2)).slice(-16) + EOL)
    }
  })
})
