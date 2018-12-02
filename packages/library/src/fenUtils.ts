import _ from "lodash";
import { FenString, ColoredPieceCode, BoardPosition, BoardSquare } from "./contracts";
import { validSquare, validPieceCode, validPositionObject } from "./boardUtils";
import { BoardColumns } from "./constants";

export function validFen(fen: FenString | undefined | null): fen is FenString {
  if (!_.isString(fen)) return false

  // cut off any move, castling, etc info from the end
  // we're only interested in position information
  fen = fen.replace(/ .+$/, '')

  // expand the empty square numbers to just 1s
  fen = expandFenEmptySquares(fen)

  // FEN should be 8 sections separated by slashes
  var chunks = fen.split('/')
  if (chunks.length !== 8) return false

  // check each section
  for (var i = 0; i < 8; i++) {
    if (chunks[i].length !== 8 ||
      chunks[i].search(/[^kqrnbpKQRNBP1]/) !== -1) {
      return false
    }
  }

  return true
}

export function squeezeFenEmptySquares(fen: string) {
  return fen.replace(/11111111/g, '8')
    .replace(/1111111/g, '7')
    .replace(/111111/g, '6')
    .replace(/11111/g, '5')
    .replace(/1111/g, '4')
    .replace(/111/g, '3')
    .replace(/11/g, '2')
}

export function expandFenEmptySquares(fen: string) {
  return fen.replace(/8/g, '11111111')
    .replace(/7/g, '1111111')
    .replace(/6/g, '111111')
    .replace(/5/g, '11111')
    .replace(/4/g, '1111')
    .replace(/3/g, '111')
    .replace(/2/g, '11')
}

// convert FEN piece code to bP, wK, etc
export function fenToPieceCode(piece: string) {
  // black piece
  if (piece.toLowerCase() === piece) {
    return 'b' + piece.toUpperCase()
  }

  // white piece
  return 'w' + piece.toUpperCase()
}

// convert bP, wK, etc code to FEN structure
export function pieceCodeToFen(piece: ColoredPieceCode) {
  var pieceCodeLetters = piece.split('')

  // white piece
  if (pieceCodeLetters[0] === 'w') {
    return pieceCodeLetters[1].toUpperCase()
  }

  // black piece
  return pieceCodeLetters[1].toLowerCase()
}

// convert FEN string to position object
// returns false if the FEN string is invalid
export function fenToObj(fen: string) {
  if (!validFen(fen)) return undefined;

  // cut off any move, castling, etc info from the end
  // we're only interested in position information
  fen = fen.replace(/ .+$/, '')

  var rows = fen.split('/')
  var position: BoardPosition = {}

  var currentRow = 8
  for (var i = 0; i < 8; i++) {
    var row = rows[i].split('')
    var colIdx = 0

    // loop through each character in the FEN section
    for (var j = 0; j < row.length; j++) {
      // number / empty squares
      if (row[j].search(/[1-8]/) !== -1) {
        var numEmptySquares = parseInt(row[j], 10)
        colIdx = colIdx + numEmptySquares
      } else {
        // piece
        var square = BoardColumns[colIdx] + currentRow;
        if (!validSquare(square)) {
          return undefined;
        }

        const pieceCode = fenToPieceCode(row[j]);
        if (!validPieceCode(pieceCode)) {
          return undefined;
        }

        position[square] = pieceCode;
        colIdx = colIdx + 1
      }
    }

    currentRow = currentRow - 1
  }

  return position
}

// position object to FEN string
// returns false if the obj is not a valid position object
export function objToFen(position: BoardPosition) {
  if (!validPositionObject(position)) return false

  var fen = ''

  var currentRow = 8
  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      var square = (BoardColumns[j] + currentRow) as BoardSquare;

      // piece exists
      const piece = position[square];
      if (piece) {
        fen = fen + pieceCodeToFen(piece)
      } else {
        // empty space
        fen = fen + '1'
      }
    }

    if (i !== 7) {
      fen = fen + '/'
    }

    currentRow = currentRow - 1
  }

  // squeeze the empty numbers together
  fen = squeezeFenEmptySquares(fen)

  return fen
}
