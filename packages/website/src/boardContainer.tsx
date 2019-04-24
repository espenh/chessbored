import * as React from "react";
import { ChessBoard } from "chessbored";
import { ChessInstance } from "chess.js";

export class BoardContainer extends React.Component {
    private container: HTMLElement | null | undefined;
    private board!: ChessBoard;
    private game!: ChessInstance;

    public componentDidMount() {
        if (!this.container) {
            return;
        }

        window.addEventListener("resize", this.updateLayout);

        this.game = this.createChessInstance();

        this.board = new ChessBoard(this.container, {
            position: "start",
            draggable: true,
            onDrop: (source, target) => {
                if (source === "offboard" || source === "spare") {
                    return;
                }

                if (target === "offboard" || target === "spare") {
                    return;
                }

                const move = this.game.move({
                    from: source,
                    to: target,
                    promotion: "q"
                });

                // Illegal move.
                if (move === null) return 'snapback';
            },
            onSnapEnd: () => {
                this.syncGameToBoard();
            },
            onDragStart: (_source, piece) => {
                if (this.game.game_over()) {
                    return false;
                }

                return this.game.turn() === piece[0];
            }
        });

        this.updateLayout();
    }

    public componentWillUnmount() {
        window.removeEventListener("resize", this.updateLayout);
        this.board.destroy();
    }

    private updateLayout = () => {
        this.board.resize();
    }

    private syncGameToBoard = () => {
        this.board.position(this.game.fen());
    }

    private makeRandomMove = () => {
        const moves = this.game.moves();
        if (!moves || !moves.length) {
            return;
        }

        const randomMoveIndex = Math.floor(Math.random() * moves.length);
        this.game.move(moves[randomMoveIndex]);
        this.syncGameToBoard();
    }

    private resetBoard = () => {
        this.game.reset();
        this.syncGameToBoard();
    }

    public render() {
        return <div className="board-with-toolbar">
            <div className="board-toolbar">
                <button onClick={() => this.board.flip()}>Flip</button>
                <button onClick={this.makeRandomMove}>Random</button>
                <button onClick={this.resetBoard}>Reset</button>
            </div>
            <div className="board-container" ref={element => this.container = element} />
        </div>;
    }

    private createChessInstance: () => ChessInstance = require("chess.js");
}
