import { squareDistance } from "../boardUtils";
import { ChessBoard } from "../chessboard";

describe("Board utils", () => {
    test("Square distance", () => {
        expect(squareDistance("a1", "a3")).toEqual(2);
        expect(squareDistance("a3", "a1")).toEqual(2);
        expect(squareDistance("b3", "b6")).toEqual(3);
        expect(squareDistance("b3", "c6")).toEqual(3);

        const div = document.createElement("div");
        const board = new ChessBoard(div, {});
        const orientation = board.flip();
        
    });
});
