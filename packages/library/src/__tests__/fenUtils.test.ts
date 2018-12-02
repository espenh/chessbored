import { ChessBoard } from "../chessboard";
import { validFen } from "../fenUtils";
import { StartFen } from "../constants";
import * as _ from "lodash";

describe("FEN parsing", () => {
    test("Handle valid FEN strings", () => {
        const validFens: string[] = [
            StartFen,
            '8/8/8/8/8/8/8/8',
            'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R',
            'r2q1rk1/bp3p2/p1npbn1p/4p1p1/P1N1P2B/1NPB4/1P2QPPP/R4RK1 w - - 0 15'
        ];

        validFens.forEach(fen => {
            expect(validFen(fen)).toBeTruthy();
        })
    });

    test("Handle invalid FEN strings", () => {
        const invalidFens = [
            undefined,
            null,
            'party',
            'anbqkbnr/8/8/8/8/8/PPPPPPPP/8',
            'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/',
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN",
            '3r3z/1p4pp/2nb1k2/pP3p2/8/PB2PN2/p4PPP/R4RK1 b - - 0 1'
        ];

        invalidFens.forEach(fen => {
            expect(validFen(fen)).toBeFalsy();
        })
    });
});
