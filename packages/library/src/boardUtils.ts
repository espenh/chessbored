import _ from "lodash";
import { BoardSquare, ColoredPieceCode, BoardPosition } from "./contracts";
import { BoardColumns } from "./constants";

export function validSquare(square: string | undefined | null): square is BoardSquare {
    return square !== undefined && _.isString(square) && square.search(/^[a-h][1-8]$/) !== -1;
}

export function validPieceCode(code: string | undefined | null): code is ColoredPieceCode {
    return code !== undefined && _.isString(code) && code.search(/^[bw][KQRNBP]$/) !== -1
}

export function validPositionObject(pos: { [key: string]: string | undefined }): pos is BoardPosition {
    if (!_.isPlainObject(pos)) {
        return false;
    }

    return _.every(pos, (pieceType: string | undefined, square: string) => {
        return validSquare(square) && validPieceCode(pieceType);
    });
}

export function squareDistance(squareA: BoardSquare, squareB: BoardSquare) {
    var squareAArray = squareA.split('')
    var squareAx = BoardColumns.indexOf(squareAArray[0]) + 1
    var squareAy = parseInt(squareAArray[1], 10)

    var squareBArray = squareB.split('')
    var squareBx = BoardColumns.indexOf(squareBArray[0]) + 1
    var squareBy = parseInt(squareBArray[1], 10)

    var xDelta = Math.abs(squareAx - squareBx)
    var yDelta = Math.abs(squareAy - squareBy)

    if (xDelta >= yDelta) return xDelta
    return yDelta
}

// returns the square of the closest instance of piece
// returns false if no instance of piece is found in position
export function findClosestPiece(position: BoardPosition, piece: ColoredPieceCode, square: BoardSquare): BoardSquare | false {
    // create array of closest squares from square
    var closestSquares = createRadius(square)

    // search through the position in order of distance for the piece
    for (var i = 0; i < closestSquares.length; i++) {
        var s = closestSquares[i] as BoardSquare;

        if (position.hasOwnProperty(s) && position[s] === piece) {
            return s;
        }
    }

    return false
}

// returns an array of closest squares from square
export function createRadius(square: BoardSquare) {
    var squares: { square: BoardSquare, distance: number }[] = []

    // calculate distance of all squares
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            var s = (BoardColumns[i] + (j + 1)) as BoardSquare;

            // skip the square we're starting from
            if (square === s) continue

            squares.push({
                square: s,
                distance: squareDistance(square, s)
            })
        }
    }

    // sort by distance
    squares.sort((a, b) => {
        return a.distance - b.distance
    });

    // just return the square code
    var surroundingSquares: BoardSquare[] = []
    for (i = 0; i < squares.length; i++) {
        surroundingSquares.push(squares[i].square)
    }

    return surroundingSquares;
}
