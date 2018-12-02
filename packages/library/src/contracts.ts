export interface IChessBoardConfig {
    draggable: boolean;
    dropOffBoard: "trash" | "snapback";
    sparePieces: boolean;
    pieceTheme: string;
    position: "start" | FenString | BoardPosition;

    appearSpeed: number;
    moveSpeed: number;
    snapbackSpeed: number;
    snapSpeed: number;
    trashSpeed: number;
    dragThrottleRate: number;

    orientation: BoardOrientation;

    showErrors: boolean | "console" | "alert" | ((err: string) => void);

    showNotation: boolean;

    onChange(oldPosition: BoardPosition, newPosition: BoardPosition): void;
    onMoveEnd(oldPosition: BoardPosition, newPosition: BoardPosition): void;
    onDrop(draggedPieceSource: PiecePosition, location: PiecePosition, draggedPiece: ColoredPieceCode, newPosition: BoardPosition, oldPosition: BoardPosition, currentOrientation: BoardOrientation): "snapback" | "trash" | "drop" | undefined;
    onSnapbackEnd(draggedPiece: ColoredPieceCode, draggedPieceSource: PiecePosition, currentPosition: BoardPosition, currentOrientation: BoardOrientation): void;
    onSnapEnd(draggedPieceSource: PiecePosition, square: todo, draggedPiece: ColoredPieceCode): void;

    onDragStart(source: PiecePosition, piece: ColoredPieceCode, currentPosition: BoardPosition, currentOrientation: BoardOrientation): boolean;
    onDragMove(location: todo, draggedPieceLocation: todo, draggedPieceSource: todo, draggedPiece: todo, currentPosition: BoardPosition, currentOrientation: BoardOrientation): void;

    onMouseoverSquare(square: todo, piece: todo, currentPosition: BoardPosition, currentOrientation: BoardOrientation): void;
    onMouseoutSquare(square: todo, piece: todo, currentPosition: BoardPosition, currentOrientation: BoardOrientation): void;
}

interface IMoveBoardAnimation {
    type: "move";
    source: BoardSquare;
    piece: ColoredPieceCode;
    destination: BoardSquare;
}

interface IAddBoardAnimation {
    type: "add";
    square: BoardSquare;
    piece: ColoredPieceCode;
}

interface IClearBoardAnimation {
    type: "clear";
    square: BoardSquare;
}

export type BoardAnimation = IMoveBoardAnimation | IAddBoardAnimation | IClearBoardAnimation;

type todo = any;

export type OffBoardLocation = "offboard" | "spare";
export type PiecePosition = OffBoardLocation | BoardSquare;
export type BoardPosition = { [key in BoardSquare]?: ColoredPieceCode };
export type AnimationSpeed = "fast" | "slow";
export type BoardOrientation = "white" | "black";
export type FenString = string;

export type ColoredPieceCode = "bP" | "bN" | "bB" | "bR" | "bQ" | "bK"
    | "wP" | "wN" | "wB" | "wR" | "wQ" | "wK";

export type BoardSquare =
    "a1" | "a2" | "a3" | "a4" | "a5" | "a6" | "a7" | "a8" |
    "b1" | "b2" | "b3" | "b4" | "b5" | "b6" | "b7" | "b8" |
    "c1" | "c2" | "c3" | "c4" | "c5" | "c6" | "c7" | "c8" |
    "d1" | "d2" | "d3" | "d4" | "d5" | "d6" | "d7" | "d8" |
    "e1" | "e2" | "e3" | "e4" | "e5" | "e6" | "e7" | "e8" |
    "f1" | "f2" | "f3" | "f4" | "f5" | "f6" | "f7" | "f8" |
    "g1" | "g2" | "g3" | "g4" | "g5" | "g6" | "g7" | "g8" |
    "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "h7" | "h8";
