import * as _ from "lodash";
import $ from "jquery";
import v4 from "uuid";

import { BoardPosition, AnimationSpeed, BoardSquare, ColoredPieceCode, FenString, IChessBoardConfig, BoardOrientation, PiecePosition, BoardAnimation } from "./contracts";
import { validFen, fenToObj, objToFen } from "./fenUtils";
import { StartFen, CssConstants, BoardColumns } from "./constants";
import { validSquare, validPositionObject, validPieceCode, findClosestPiece } from "./boardUtils";

import "./chessboard.css";

export class ChessBoard {
  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  private DEFAULT_DRAG_THROTTLE_RATE = 20
  private ELLIPSIS = '…'

  private START_POSITION: BoardPosition = fenToObj(StartFen) as BoardPosition;

  // default animation speeds
  private DEFAULT_APPEAR_SPEED = 200
  private DEFAULT_MOVE_SPEED = 200
  private DEFAULT_SNAPBACK_SPEED = 60
  private DEFAULT_SNAP_SPEED = 30
  private DEFAULT_TRASH_SPEED = 100

  // use unique class names to prevent clashing with anything else on the page
  // and simplify selectors
  // NOTE: these should never change
  throttledMousemoveWindow: ((evt: JQuery.Event<EventTarget, null>) => void) & _.Cancelable;
  throttledTouchmoveWindow: ((evt: JQuery.Event<EventTarget, null>) => void) & _.Cancelable;





  // ---------------------------------------------------------------------------
  // Misc Util Functions
  // ---------------------------------------------------------------------------


  private uuid() {
    return v4();
  }

  private deepCopy<T>(thing: T) {
    return _.cloneDeep(thing);
  }

  private interpolateTemplate(str: string, obj: { [key: string]: string }) {
    for (var key in obj) {
      if (!obj.hasOwnProperty(key)) continue
      var keyTemplateStr = '{' + key + '}'
      var value = obj[key]
      while (str.indexOf(keyTemplateStr) !== -1) {
        str = str.replace(keyTemplateStr, value)
      }
    }
    return str
  }


  // ---------------------------------------------------------------------------
  // Predicates
  // ---------------------------------------------------------------------------

  private validAnimationSpeed(speed: number | AnimationSpeed | undefined): speed is number | AnimationSpeed {
    if (speed === undefined) {
      return false;
    }

    if (speed === 'fast' || speed === 'slow') return true
    if (!_.isInteger(speed)) return false
    return speed >= 0
  }

  private validThrottleRate(rate: number | undefined): rate is number {
    if (rate === undefined) {
      return false;
    }

    return _.isInteger(rate) && rate >= 1
  }

  private validMove(move: string) {
    // move should be a string
    if (!_.isString(move)) return false

    // move should be in the form of "e2-e4", "f6-d5"
    var squares = move.split('-') as [BoardSquare, BoardSquare];
    if (squares.length !== 2) return false

    return validSquare(squares[0]) && validSquare(squares[1])
  }

  private isTouchDevice() {
    return document.documentElement && document.documentElement.hasOwnProperty("ontouchstart");
  }

  // given a position and a set of moves, return a new position
  // with the moves executed
  private calculatePositionFromMoves(position: BoardPosition, moves: { [key in BoardSquare]?: BoardSquare }) {
    var newPosition = this.deepCopy(position)

    _.each(moves, (toSquare: BoardSquare | undefined, fromSquareAsText) => {
      if (!toSquare) {
        return;
      }

      const fromSquare = fromSquareAsText as BoardSquare;

      // skip the move if the position doesn't have a piece on the source square
      if (!newPosition.hasOwnProperty(fromSquare)) return;

      var piece = newPosition[fromSquare]
      if (piece) {
        delete newPosition[fromSquare];
        newPosition[toSquare] = piece
      }
    });

    return newPosition
  }

  // TODO: add some asserts here for calculatePositionFromMoves

  // ---------------------------------------------------------------------------
  // HTML
  // ---------------------------------------------------------------------------

  private buildContainerHTML(hasSparePieces: boolean) {
    var html = '<div class="{chessboard}">'

    if (hasSparePieces) {
      html += '<div class="{sparePieces} {sparePiecesTop}"></div>'
    }

    html += '<div class="{board}"></div>'

    if (hasSparePieces) {
      html += '<div class="{sparePieces} {sparePiecesBottom}"></div>'
    }

    html += '</div>'

    return this.interpolateTemplate(html, CssConstants)
  }

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  private expandConfigArgumentShorthand(config: "start" | FenString | BoardPosition | undefined): BoardPosition | undefined {
    if (config === 'start') {
      return this.deepCopy(this.START_POSITION);
    } else if (_.isString(config) && validFen(config)) {
      const positionFromFen = fenToObj(config);
      if (!positionFromFen) {
        throw new Error("Invalid fen. Unable to create position");
      }

      return positionFromFen;
    } else if (config && validPositionObject(config)) {
      return this.deepCopy(config);
    }

    return undefined;
  }

  // validate config / set default options
  private expandConfig(config: Partial<IChessBoardConfig>): IChessBoardConfig {
    // default for orientation is white
    if (config.orientation !== 'black') config.orientation = 'white'

    // default for showNotation is true
    if (config.showNotation !== false) config.showNotation = true

    // default for draggable is false
    if (config.draggable !== true) config.draggable = false

    // default for dropOffBoard is 'snapback'
    if (config.dropOffBoard !== 'trash') config.dropOffBoard = 'snapback'

    // default for sparePieces is false
    if (config.sparePieces !== true) config.sparePieces = false

    // draggable must be true if sparePieces is enabled
    if (config.sparePieces) config.draggable = true

    /*
    // default piece theme is wikipedia
    if (!config.hasOwnProperty('pieceTheme') ||
      (!_.isString(config.pieceTheme) && !_.isFunction(config.pieceTheme))) {
      config.pieceTheme = 'img/chesspieces/wikipedia/{piece}.png'
    }*/

    // animation speeds
    if (!this.validAnimationSpeed(config.appearSpeed)) config.appearSpeed = this.DEFAULT_APPEAR_SPEED
    if (!this.validAnimationSpeed(config.moveSpeed)) config.moveSpeed = this.DEFAULT_MOVE_SPEED
    if (!this.validAnimationSpeed(config.snapbackSpeed)) config.snapbackSpeed = this.DEFAULT_SNAPBACK_SPEED
    if (!this.validAnimationSpeed(config.snapSpeed)) config.snapSpeed = this.DEFAULT_SNAP_SPEED
    if (!this.validAnimationSpeed(config.trashSpeed)) config.trashSpeed = this.DEFAULT_TRASH_SPEED

    // throttle rate
    if (!this.validThrottleRate(config.dragThrottleRate)) config.dragThrottleRate = this.DEFAULT_DRAG_THROTTLE_RATE

    return config as IChessBoardConfig;
  }

  // ---------------------------------------------------------------------------
  // Dependencies
  // ---------------------------------------------------------------------------

  // return either boolean false or the $container element
  private checkContainerArg(containerOrSelector: string | HTMLElement) {
    let container: HTMLElement | null = null;

    if (_.isString(containerOrSelector)) {
      container = document.querySelector(containerOrSelector) as HTMLElement | null;
      if (container === null) {
        throw new Error("Unable to find container at: " + containerOrSelector);
      }
    } else {
      container = containerOrSelector;
    }

    if (!container) {
      var errorMessage = 'Chessboard Error 1003: ' +
        'The first argument to Chessboard() must be the ID of a DOM node, ' +
        'an ID query selector, or a single DOM node.' +
        '\n\n' +
        'Exiting' + this.ELLIPSIS

      throw new Error(errorMessage);
    }

    return container;
  }

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  private $container: JQuery<HTMLElement>;
  // DOM elements
  private $board!: JQuery<HTMLElement>;
  private $draggedPiece!: JQuery<HTMLElement>;
  private $sparePiecesTop: JQuery<HTMLElement> | undefined;
  private $sparePiecesBottom: JQuery<HTMLElement> | undefined;

  // -------------------------------------------------------------------------
  // Stateful
  // -------------------------------------------------------------------------

  private boardBorderSize = 2
  private currentOrientation: BoardOrientation = 'white'
  private currentPosition!: BoardPosition;
  private draggedPiece: ColoredPieceCode | null = null
  private draggedPieceLocation: PiecePosition | null = null;
  private draggedPieceSource: PiecePosition | null = null;
  private isDragging = false
  private sparePiecesElsIds: { [key in ColoredPieceCode]?: string } = {};
  private squareElsIds: { [key in BoardSquare]?: string } = {};
  private squareElsOffsets: { [key: string]: JQuery.Coordinates } = {};
  private squareSize = 16
  private config: IChessBoardConfig;



  constructor(containerElOrString: string | HTMLElement, configCandidate: Partial<IChessBoardConfig>) {
    this.$container = $(this.checkContainerArg(containerElOrString));

    // ensure the config object is what we expect
    //const boardFromConfig = this.expandConfigArgumentShorthand(config);
    this.config = this.expandConfig(configCandidate);

    this.throttledMousemoveWindow = _.throttle(this.mousemoveWindow, this.config.dragThrottleRate)
    this.throttledTouchmoveWindow = _.throttle(this.touchmoveWindow, this.config.dragThrottleRate)

    this.setInitialState()
    this.initDOM()
    this.addEvents()
  }

  private error(code: string, msg: string, obj: any) {
    // do nothing if showErrors is not set
    if (
      this.config.hasOwnProperty('showErrors') !== true ||
      this.config.showErrors === false
    ) {
      return
    }

    var errorText = 'Chessboard Error ' + code + ': ' + msg

    // print to console
    if (
      this.config.showErrors === 'console' &&
      typeof console === 'object' &&
      typeof console.log === 'function'
    ) {
      console.log(errorText)
      if (arguments.length >= 2) {
        console.log(obj)
      }
      return
    }

    // alert errors
    if (this.config.showErrors === 'alert') {
      if (obj) {
        errorText += '\n\n' + JSON.stringify(obj)
      }
      window.alert(errorText)
      return
    }

    // custom function
    if (_.isFunction(this.config.showErrors)) {
      this.config.showErrors(code, msg, obj)
    }
  }

  private setInitialState() {
    this.currentOrientation = this.config.orientation

    // make sure position is valid
    if (this.config.hasOwnProperty('position')) {
      if (this.config.position === 'start') {
        this.currentPosition = this.deepCopy(this.START_POSITION)
      } else if (_.isString(this.config.position) && validFen(this.config.position)) {
        const positionFromConfig = fenToObj(this.config.position);
        if (positionFromConfig === undefined) {
          throw new Error("Invalid fen in config.position.");
        }
        this.currentPosition = positionFromConfig;
      } else if (validPositionObject(this.config.position)) {
        this.currentPosition = this.deepCopy(this.config.position)
      } else {
        throw new Error('Invalid value passed to config.position.');
      }
    }
  }

  // -------------------------------------------------------------------------
  // DOM Misc
  // -------------------------------------------------------------------------

  // calculates square size based on the width of the container
  // got a little CSS black magic here, so let me explain:
  // get the width of the container element (could be anything), reduce by 1 for
  // fudge factor, and then keep reducing until we find an exact mod 8 for
  // our square size
  private calculateSquareSize() {
    const containerWidth = this.$container.width() || 0;
    const containerHeight = this.$container.height() || 0;
    const sizeToUse = Math.round(Math.min(containerWidth, containerHeight));

    // defensive, prevent infinite loop
    if (!sizeToUse || sizeToUse <= 0) {
      return 0
    }

    // pad one pixel
    var boardWidth = sizeToUse - 1

    while (boardWidth % 8 !== 0 && boardWidth > 0) {
      boardWidth = boardWidth - 1
    }

    return boardWidth / 8
  }

  // create random IDs for elements
  private createElIds() {
    // squares on the board
    for (var i = 0; i < BoardColumns.length; i++) {
      for (var j = 1; j <= 8; j++) {
        var square = (BoardColumns[i] + j) as BoardSquare;
        this.squareElsIds[square] = square + '-' + this.uuid()
      }
    }

    // spare pieces
    var pieces = 'KQRNBP'.split('')
    for (i = 0; i < pieces.length; i++) {
      var whitePiece = ('w' + pieces[i]) as ColoredPieceCode;
      var blackPiece = ('b' + pieces[i]) as ColoredPieceCode;

      this.sparePiecesElsIds[whitePiece] = whitePiece + '-' + this.uuid()
      this.sparePiecesElsIds[blackPiece] = blackPiece + '-' + this.uuid()
    }
  }

  // -------------------------------------------------------------------------
  // Markup Building
  // -------------------------------------------------------------------------

  private buildBoardHTML(orientation: BoardOrientation, squareSize: number, showNotation: boolean) {
    if (orientation !== 'black') {
      orientation = 'white'
    }

    var html = ''

    // algebraic notation / orientation
    var alpha = this.deepCopy(BoardColumns)
    var row = 8
    if (orientation === 'black') {
      alpha.reverse()
      row = 1
    }

    var squareColor: "white" | "black" = 'white'
    for (var i = 0; i < 8; i++) {
      html += '<div class="{row}">'
      for (var j = 0; j < 8; j++) {
        var square = (alpha[j] + row) as BoardSquare;

        html += '<div class="{square} ' + CssConstants[squareColor] + ' ' +
          'square-' + square + '" ' +
          'style="width:' + squareSize + 'px;height:' + squareSize + 'px;" ' +
          'id="' + this.squareElsIds[square] + '" ' +
          'data-square="' + square + '">'

        if (showNotation) {
          // alpha notation
          if ((orientation === 'white' && row === 1) ||
            (orientation === 'black' && row === 8)) {
            html += '<div class="{notation} {alpha}">' + alpha[j] + '</div>'
          }

          // numeric notation
          if (j === 0) {
            html += '<div class="{notation} {numeric}">' + row + '</div>'
          }
        }

        html += '</div>' // end .square

        squareColor = (squareColor === 'white') ? 'black' : 'white'
      }
      html += '<div class="{clearfix}"></div></div>'

      squareColor = (squareColor === 'white') ? 'black' : 'white'

      if (orientation === 'white') {
        row = row - 1
      } else {
        row = row + 1
      }
    }

    return this.interpolateTemplate(html, CssConstants)
  }

  private buildPieceImgSrc(piece: ColoredPieceCode) {
    if (_.isFunction(this.config.pieceTheme)) {
      return this.config.pieceTheme(piece)
    }

    if (_.isString(this.config.pieceTheme)) {
      return this.interpolateTemplate(this.config.pieceTheme, { piece: piece })
    }

    return undefined;
  }

  private buildPieceHTML(piece: ColoredPieceCode, hidden?: boolean, id?: string) {

    const useUserSpecifiedImage = this.config.pieceTheme !== undefined;

    const attributes: { [key: string]: string | undefined } = {
      id: id,
      alt: piece,
      class: CssConstants.piece,
      // Use an image source if theme is specified.
      src: useUserSpecifiedImage && this.buildPieceImgSrc(piece),
      "data-piece": piece,
      style: `width: ${this.squareSize}px; height: ${this.squareSize}px; ${hidden ? "display: none; " : ""} display: flex; justify-content: center; align-items: center;`
    };

    const keys = Object.keys(attributes);
    const attributeString = keys.map(key => {
      const value = attributes[key];
      if (value) {
        return `${key}="${attributes[key]}"`
      }

      return "";
    });

    if (useUserSpecifiedImage) {
      return `<img ${attributeString.join(" ")} />`;
    }

    // Fall back to using divs that have a background image (the piece).
    return `<div ${attributeString.join(" ")} />`;
  }

  private buildSparePiecesHTML(color: "black" | "white") {
    var pieces: ColoredPieceCode[] = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP']
    if (color === 'black') {
      pieces = ['bK', 'bQ', 'bR', 'bB', 'bN', 'bP']
    }

    var html = ''
    for (var i = 0; i < pieces.length; i++) {
      html += this.buildPieceHTML(pieces[i], false, this.sparePiecesElsIds[pieces[i]])
    }

    return html
  }

  // -------------------------------------------------------------------------
  // Animations
  // -------------------------------------------------------------------------

  private animateSquareToSquare(src: BoardSquare, dest: BoardSquare, piece: ColoredPieceCode, completeFn?: () => void) {
    // get information about the source and destination squares
    var $srcSquare = $('#' + this.squareElsIds[src])
    var srcSquarePosition = $srcSquare.offset()

    if (!srcSquarePosition) {
      throw new Error("No srcSquarePosition found.");
    }

    var $destSquare = $('#' + this.squareElsIds[dest])
    var destSquarePosition = $destSquare.offset()

    if (!destSquarePosition) {
      throw new Error("No destSquarePosition found.");
    }

    // create the animated piece and absolutely position it
    // over the source square
    var animatedPieceId = this.uuid();
    $('body').append(this.buildPieceHTML(piece, true, animatedPieceId))
    var $animatedPiece = $('#' + animatedPieceId)
    $animatedPiece.css({
      display: '',
      position: 'absolute',
      top: srcSquarePosition.top,
      left: srcSquarePosition.left
    })

    // remove original piece from source square
    $srcSquare.find('.' + CssConstants.piece).remove()

    const onFinishAnimation1 = () => {
      // add the "real" piece to the destination square
      $destSquare.append(this.buildPieceHTML(piece))

      // remove the animated piece
      $animatedPiece.remove()

      // run complete function
      if (_.isFunction(completeFn)) {
        completeFn()
      }
    }

    // animate the piece to the destination square
    var opts = {
      duration: this.config.moveSpeed,
      complete: onFinishAnimation1
    }
    $animatedPiece.animate(destSquarePosition, opts)
  }

  private animateSparePieceToSquare(piece: ColoredPieceCode, dest: BoardSquare, completeFn: () => void) {
    var srcOffset = $('#' + this.sparePiecesElsIds[piece]).offset()
    if (!srcOffset) {
      throw new Error("No srcOffset found.");
    }

    var $destSquare = $('#' + this.squareElsIds[dest])
    var destOffset = $destSquare.offset()

    if (!destOffset) {
      throw new Error("No destOffset found.");
    }

    // create the animate piece
    var pieceId = this.uuid()
    $('body').append(this.buildPieceHTML(piece, true, pieceId))
    var $animatedPiece = $('#' + pieceId)
    $animatedPiece.css({
      display: '',
      position: 'absolute',
      left: srcOffset.left,
      top: srcOffset.top
    })

    // on complete
    const onFinishAnimation2 = () => {
      // add the "real" piece to the destination square
      $destSquare.find('.' + CssConstants.piece).remove()
      $destSquare.append(this.buildPieceHTML(piece))

      // remove the animated piece
      $animatedPiece.remove()

      // run complete function
      if (_.isFunction(completeFn)) {
        completeFn()
      }
    }

    // animate the piece to the destination square
    var opts = {
      duration: this.config.moveSpeed,
      complete: onFinishAnimation2
    };

    $animatedPiece.animate(destOffset, opts)
  }

  // execute an array of animations
  private doAnimations(animations: BoardAnimation[], oldPos: BoardPosition, newPos: BoardPosition) {
    if (animations.length === 0) return

    var numFinished = 0
    const onFinishAnimation3 = () => {
      // exit if all the animations aren't finished
      numFinished = numFinished + 1
      if (numFinished !== animations.length) return

      this.drawPositionInstant()

      // run their onMoveEnd function
      if (_.isFunction(this.config.onMoveEnd)) {
        this.config.onMoveEnd(this.deepCopy(oldPos), this.deepCopy(newPos))
      }
    }

    for (var i = 0; i < animations.length; i++) {
      var animation = animations[i]

      // clear a piece
      if (animation.type === 'clear') {
        $('#' + this.squareElsIds[animation.square] + ' .' + CssConstants.piece)
          .fadeOut(this.config.trashSpeed, onFinishAnimation3)

        // add a piece with no spare pieces - fade the piece onto the square
      } else if (animation.type === 'add' && !this.config.sparePieces) {
        $('#' + this.squareElsIds[animation.square])
          .append(this.buildPieceHTML(animation.piece, true))
          .find('.' + CssConstants.piece)
          .fadeIn(this.config.appearSpeed, onFinishAnimation3)

        // add a piece with spare pieces - animate from the spares
      } else if (animation.type === 'add' && this.config.sparePieces) {
        this.animateSparePieceToSquare(animation.piece, animation.square, onFinishAnimation3)

        // move a piece from squareA to squareB
      } else if (animation.type === 'move') {
        this.animateSquareToSquare(animation.source, animation.destination, animation.piece, onFinishAnimation3)
      }
    }
  }

  // calculate an array of animations that need to happen in order to get
  // from pos1 to pos2
  private calculateAnimations(fromPosition: BoardPosition, toPosition: BoardPosition) {
    // make copies of both
    // TODO - Do we really need copies here?
    const pos1 = this.deepCopy(fromPosition)
    const pos2 = this.deepCopy(toPosition)

    var animations: BoardAnimation[] = []
    var squaresMovedTo: { [square in BoardSquare]?: boolean } = {}

    // Remove pieces that are the same in both positions
    this.iteratePosition(pos2, (piece, square) => {
      if (pos1.hasOwnProperty(square) && pos1[square] === pos2[square]) {
        delete pos1[square]
        delete pos2[square]
      }
    });

    // find all the "move" animations
    this.iteratePosition(pos2, (piece, square) => {
      var closestPiece = findClosestPiece(pos1, piece, square)
      if (closestPiece) {
        animations.push({
          type: 'move',
          source: closestPiece,
          destination: square,
          piece: piece
        })

        delete pos1[closestPiece];
        delete pos2[square];

        squaresMovedTo[square] = true
      }
    });

    // "add" animations
    this.iteratePosition(pos2, (piece, square) => {
      animations.push({
        type: 'add',
        square: square,
        piece: piece
      });

      delete pos2[square]
    });

    // "clear" animations
    this.iteratePosition(pos1, (piece, square) => {

      // do not clear a piece if it is on a square that is the result
      // of a "move", ie: a piece capture
      if (squaresMovedTo.hasOwnProperty(square)) return;

      animations.push({
        type: 'clear',
        square: square
      })

      delete pos1[square]
    });

    return animations;
  }

  // -------------------------------------------------------------------------
  // Control Flow
  // -------------------------------------------------------------------------

  private iteratePosition(position: BoardPosition, func: (piece: ColoredPieceCode, square: BoardSquare) => void) {
    _.each(position, (piece: ColoredPieceCode | undefined, key) => {
      const square = key as BoardSquare;
      if (piece === undefined) {
        return;
      }

      func(piece, square);
    });
  }

  private drawPositionInstant() {
    // clear the board
    this.$board.find('.' + CssConstants.piece).remove()

    // add the pieces
    this.iteratePosition(this.currentPosition, (piece, square) => {
      $('#' + this.squareElsIds[square]).append(this.buildPieceHTML(piece))
    });
  }

  private drawBoard() {
    this.$board.html(this.buildBoardHTML(this.currentOrientation, this.squareSize, this.config.showNotation))
    this.drawPositionInstant()

    if (this.config.sparePieces && this.$sparePiecesTop && this.$sparePiecesBottom) {
      if (this.currentOrientation === 'white') {
        this.$sparePiecesTop.html(this.buildSparePiecesHTML('black'))
        this.$sparePiecesBottom.html(this.buildSparePiecesHTML('white'))
      } else {
        this.$sparePiecesTop.html(this.buildSparePiecesHTML('white'))
        this.$sparePiecesBottom.html(this.buildSparePiecesHTML('black'))
      }
    }
  }

  private setCurrentPosition(position: BoardPosition) {
    var oldPos = this.deepCopy(this.currentPosition)
    var newPos = this.deepCopy(position)
    var oldFen = objToFen(oldPos)
    var newFen = objToFen(newPos)

    // do nothing if no change in position
    if (oldFen === newFen) return

    // run their onChange function
    if (_.isFunction(this.config.onChange)) {
      this.config.onChange(oldPos, newPos)
    }

    // update state
    this.currentPosition = position
  }

  private isXYOnSquare(x: number, y: number): PiecePosition {
    for (var i in this.squareElsOffsets) {
      if (!this.squareElsOffsets.hasOwnProperty(i)) continue

      var s = this.squareElsOffsets[i]
      if (x >= s.left &&
        x < s.left + this.squareSize &&
        y >= s.top &&
        y < s.top + this.squareSize) {
        return i as BoardSquare;
      }
    }

    return 'offboard'
  }

  // records the XY coords of every square into memory
  private captureSquareOffsets() {
    this.squareElsOffsets = {}

    const squareElementIds = Object.keys(this.squareElsIds) as BoardSquare[];
    _.each(squareElementIds, elementId => {
      const offset = $('#' + this.squareElsIds[elementId]).offset();
      if (offset) {
        this.squareElsOffsets[elementId] = offset;
      }
    });
  }

  private removeSquareHighlights() {
    this.$board
      .find('.' + CssConstants.square)
      .removeClass(CssConstants.highlight1 + ' ' + CssConstants.highlight2)
  }

  private snapbackDraggedPiece(draggedPiece: ColoredPieceCode, draggedPieceSource: PiecePosition) {
    // there is no "snapback" for spare pieces
    if (draggedPieceSource === 'spare') {
      this.trashDraggedPiece(draggedPieceSource)
      return
    }

    this.removeSquareHighlights()

    // animation complete
    const complete = () => {
      this.drawPositionInstant()
      this.$draggedPiece.css('display', 'none')

      // run their onSnapbackEnd function
      if (_.isFunction(this.config.onSnapbackEnd)) {
        this.config.onSnapbackEnd(
          draggedPiece,
          draggedPieceSource,
          this.deepCopy(this.currentPosition),
          this.currentOrientation
        )
      }
    }

    // get source square position
    if (!validSquare(draggedPieceSource)) {
      return;
    }

    var sourceSquarePosition = $('#' + this.squareElsIds[draggedPieceSource]).offset()
    if (!sourceSquarePosition) {
      return;
    }

    // animate the piece to the target square
    var opts = {
      duration: this.config.snapbackSpeed,
      complete: complete
    }

    this.$draggedPiece.animate(sourceSquarePosition, opts)

    // set state
    // TODO - There are two returns above here. Is it a problem that we're setting isDragging here?
    this.isDragging = false
  }

  private trashDraggedPiece(draggedPieceSource: PiecePosition) {
    this.removeSquareHighlights()

    // remove the source piece
    var newPosition = this.deepCopy(this.currentPosition)

    if (validSquare(draggedPieceSource)) {
      delete newPosition[draggedPieceSource]
    }

    this.setCurrentPosition(newPosition)

    // redraw the position
    this.drawPositionInstant()

    // hide the dragged piece
    this.$draggedPiece.fadeOut(this.config.trashSpeed)

    // set state
    this.isDragging = false
  }

  private dropDraggedPieceOnSquare(square: PiecePosition, draggedPiece: ColoredPieceCode, draggedPieceSource: PiecePosition) {
    this.removeSquareHighlights()

    // update position
    var newPosition = this.deepCopy(this.currentPosition)

    // We might be dragging a piece on and off the board.
    if (validSquare(draggedPieceSource)) {
      delete newPosition[draggedPieceSource];
    }

    if (validSquare(square)) {
      newPosition[square] = draggedPiece
    }

    this.setCurrentPosition(newPosition)

    // get target square information
    var targetSquarePosition = validSquare(square) && $('#' + this.squareElsIds[square]).offset();
    if (!targetSquarePosition) {
      return;
    }

    // animation complete
    const onAnimationComplete = () => {
      this.drawPositionInstant()
      this.$draggedPiece.css('display', 'none')

      // execute their onSnapEnd function
      if (_.isFunction(this.config.onSnapEnd)) {
        this.config.onSnapEnd(draggedPieceSource, square, draggedPiece)
      }
    }

    // snap the piece to the target square
    var opts = {
      duration: this.config.snapSpeed,
      complete: onAnimationComplete
    }
    this.$draggedPiece.animate(targetSquarePosition, opts)

    // set state
    this.isDragging = false
  }

  private beginDraggingPiece(source: PiecePosition, piece: ColoredPieceCode, x: number, y: number) {
    // run their custom onDragStart function
    // their custom onDragStart private can cancel drag start
    if (_.isFunction(this.config.onDragStart) &&
      this.config.onDragStart(source, piece, this.deepCopy(this.currentPosition), this.currentOrientation) === false) {
      return
    }

    // set state
    this.isDragging = true
    this.draggedPiece = piece
    this.draggedPieceSource = source

    // if the piece came from spare pieces, location is offboard
    if (source === 'spare') {
      this.draggedPieceLocation = 'offboard'
    } else {
      this.draggedPieceLocation = source
    }

    // capture the x, y coords of all squares in memory
    this.captureSquareOffsets()

    // create the dragged piece
    // Update the piece image if theme is specified.
    if (this.config.pieceTheme) {
      this.$draggedPiece.attr('src', this.buildPieceImgSrc(piece));
    }

    this.$draggedPiece.attr('data-piece', piece).css({
      display: '',
      position: 'absolute',
      left: x - this.squareSize / 2,
      top: y - this.squareSize / 2
    })

    if (source !== 'spare' && validSquare(source)) {
      // highlight the source square and hide the piece
      $('#' + this.squareElsIds[source])
        .addClass(CssConstants.highlight1)
        .find('.' + CssConstants.piece)
        .css('display', 'none')
    }
  }

  private updateDraggedPiece(x: number, y: number) {
    // put the dragged piece over the mouse cursor
    this.$draggedPiece.css({
      left: x - this.squareSize / 2,
      top: y - this.squareSize / 2
    })

    // get location
    var location = this.isXYOnSquare(x, y)

    // do nothing if the location has not changed
    if (location === this.draggedPieceLocation) return

    // remove highlight from previous square
    if (validSquare(this.draggedPieceLocation)) {
      $('#' + this.squareElsIds[this.draggedPieceLocation]).removeClass(CssConstants.highlight2)
    }

    // add highlight to new square
    if (validSquare(location)) {
      $('#' + this.squareElsIds[location]).addClass(CssConstants.highlight2)
    }

    // run onDragMove
    if (_.isFunction(this.config.onDragMove)) {
      this.config.onDragMove(
        location,
        this.draggedPieceLocation,
        this.draggedPieceSource,
        this.draggedPiece,
        this.deepCopy(this.currentPosition),
        this.currentOrientation
      )
    }

    // update state
    this.draggedPieceLocation = location
  }

  private stopDraggedPiece(location: PiecePosition, draggedPieceSource: PiecePosition, draggedPiece: ColoredPieceCode) {
    // determine what the action should be
    var action = 'drop'
    if (location === 'offboard' && this.config.dropOffBoard === 'snapback') {
      action = 'snapback'
    }
    if (location === 'offboard' && this.config.dropOffBoard === 'trash') {
      action = 'trash'
    }

    // run their onDrop function, which can potentially change the drop action
    if (_.isFunction(this.config.onDrop)) {
      var newPosition = this.deepCopy(this.currentPosition)

      // source piece is a spare piece and position is off the board
      // if (draggedPieceSource === 'spare' && location === 'offboard') {...}
      // position has not changed; do nothing

      // source piece is a spare piece and position is on the board
      if (draggedPieceSource === 'spare' && validSquare(location)) {
        // add the piece to the board
        newPosition[location] = draggedPiece
      }

      // source piece was on the board and position is off the board
      if (validSquare(draggedPieceSource) && location === 'offboard') {
        // remove the piece from the board
        delete newPosition[draggedPieceSource]
      }

      // source piece was on the board and position is on the board
      if (validSquare(draggedPieceSource) && validSquare(location)) {
        // move the piece
        delete newPosition[draggedPieceSource]
        newPosition[location] = draggedPiece
      }

      var oldPosition = this.deepCopy(this.currentPosition)

      var result = this.config.onDrop(
        draggedPieceSource,
        location,
        draggedPiece,
        newPosition,
        oldPosition,
        this.currentOrientation
      )
      if (result === 'snapback' || result === 'trash') {
        action = result
      }
    }

    // do it!
    if (action === 'snapback') {
      this.snapbackDraggedPiece(draggedPiece, draggedPieceSource)
    } else if (action === 'trash') {
      this.trashDraggedPiece(draggedPieceSource)
    } else if (action === 'drop') {
      this.dropDraggedPieceOnSquare(location, draggedPiece, draggedPieceSource);
    }
  }

  // -------------------------------------------------------------------------
  // Public Methods
  // -------------------------------------------------------------------------

  // clear the board
  public clear(useAnimation: boolean) {
    this.position({}, useAnimation)
  }

  // remove the widget from the page
  public destroy = () => {
    // remove markup
    this.$container.html('')
    this.$draggedPiece.remove()

    // remove event handlers
    this.$container.unbind()
  }

  // shorthand method to get the current FEN
  public fen = () => {
    return this.position('fen')
  }

  // flip orientation
  public flip = () => {
    return this.orientation('flip')
  }

  // move pieces
  public move = (movesToMake: string[], useAnimation = true) => {
    // no need to throw an error here; just do nothing
    if (movesToMake.length === 0) {
      return this.currentPosition;
    }

    // collect the moves into an object
    var moves: { [key in BoardSquare]?: BoardSquare } = {}
    movesToMake.forEach(moveToMake => {
      // skip invalid arguments
      // TODO - This is just to match the old behaviour. Invalid moves should throw an error.
      if (!this.validMove(moveToMake)) {
        return;
      }

      var tmp = moveToMake.split('-') as [BoardSquare, BoardSquare];
      moves[tmp[0]] = tmp[1]
    });

    // calculate position from moves
    var newPos = this.calculatePositionFromMoves(this.currentPosition, moves)

    // update the board
    this.position(newPos, useAnimation)

    // return the new position object
    return newPos
  }

  public orientation = (arg?: BoardOrientation | "flip") => {
    // no arguments, return the current orientation
    if (!arg) {
      return this.currentOrientation
    }

    const orientationToSet = arg === "flip" ?
      (this.currentOrientation === "white" ? "black" : "white")
      : arg;

    // Update orientation.
    this.currentOrientation = orientationToSet;
    this.drawBoard()
    return this.currentOrientation
  }

  public position = (position?: string | BoardPosition, useAnimation = true) => {
    // no arguments, return the current position
    if (!position && !useAnimation) {
      return this.deepCopy(this.currentPosition)
    }

    let positionToSet: BoardPosition | undefined;

    if (_.isString(position)) {
      // get position as FEN
      if (_.isString(position) && position.toLowerCase() === 'fen') {
        return objToFen(this.currentPosition)
      } else if (position.toLowerCase() === 'start') {
        // start position
        positionToSet = this.deepCopy(this.START_POSITION)
      } else if (validFen(position)) {
        // convert FEN to position object
        positionToSet = fenToObj(position)
      }
    } else if (!position || !validPositionObject(position)) {
      // validate position object
      throw new Error('Invalid value passed to the position method.');
    }

    if (!positionToSet) {
      throw new Error("No position to set.");
    }

    // default for useAnimations is true
    if (useAnimation !== false) useAnimation = true

    if (useAnimation) {
      // start the animations
      var animations = this.calculateAnimations(this.currentPosition, positionToSet)
      this.doAnimations(animations, this.currentPosition, positionToSet)

      // set the new position
      this.setCurrentPosition(positionToSet)
    } else {
      // instant update
      this.setCurrentPosition(positionToSet)
      this.drawPositionInstant()
    }
  }

  public resize = () => {
    // calulate the new square size
    this.squareSize = this.calculateSquareSize()

    // set board width
    this.$board.css('width', this.squareSize * 8 + 'px')

    // set drag piece size
    this.$draggedPiece.css({
      height: this.squareSize,
      width: this.squareSize
    })

    // spare pieces
    if (this.config.sparePieces) {
      this.$container
        .find('.' + CssConstants.sparePieces)
        .css('paddingLeft', this.squareSize + this.boardBorderSize + 'px')
    }

    // redraw the board
    this.drawBoard()
  }

  // set the starting position
  public start = (useAnimation = true) => {
    this.position('start', useAnimation)
  }

  // -------------------------------------------------------------------------
  // Browser Events
  // -------------------------------------------------------------------------

  private stopDefault(evt: Event) {
    evt.preventDefault()
  }

  private mousedownSquare = (evt: JQuery.Event) => {
    // do nothing if we're not draggable
    if (!this.config.draggable) return

    // do nothing if there is no piece on this square

    const targetDiv = evt.currentTarget as HTMLDivElement;
    const square = targetDiv.getAttribute('data-square')
    if (!validSquare(square)) return

    const piece = this.currentPosition[square];
    if (!validPieceCode(piece)) return

    this.beginDraggingPiece(square, piece, evt.pageX, evt.pageY)
  }

  private touchstartSquare = (evt: JQuery.Event) => {
    // do nothing if we're not draggable
    if (!this.config.draggable) return

    // do nothing if there is no piece on this square
    const targetDiv = evt.currentTarget as HTMLDivElement;
    const square = targetDiv.getAttribute('data-square')

    if (!validSquare(square)) return
    if (!this.currentPosition.hasOwnProperty(square)) return

    const changedTouches = evt.changedTouches;
    if (changedTouches) {

      const piece = this.currentPosition[square];
      if (piece) {
        this.beginDraggingPiece(
          square,
          piece,
          changedTouches[0].pageX,
          changedTouches[0].pageY
        );
      }
    }
  }

  private mousedownSparePiece = (evt: JQuery.Event) => {
    // do nothing if sparePieces is not enabled
    if (!this.config.sparePieces) return

    const targetDiv = evt.currentTarget as HTMLDivElement;
    const piece = targetDiv.getAttribute('data-piece')
    if (!validPieceCode(piece)) {
      return;
    }

    this.beginDraggingPiece('spare', piece, evt.pageX, evt.pageY)
  }

  private touchstartSparePiece = (evt: JQuery.Event) => {
    // do nothing if sparePieces is not enabled
    if (!this.config.sparePieces) return

    const targetDiv = evt.currentTarget as HTMLDivElement;
    const piece = targetDiv.getAttribute('data-piece')

    if (!validPieceCode(piece)) {
      return;
    }

    const changedTouches = evt.changedTouches;
    if (changedTouches) {

      this.beginDraggingPiece(
        'spare',
        piece,
        changedTouches[0].pageX,
        changedTouches[0].pageY
      )
    }
  }

  private mousemoveWindow = (evt: JQuery.Event) => {
    if (this.isDragging) {
      this.updateDraggedPiece(evt.pageX, evt.pageY)
    }
  }



  private touchmoveWindow = (evt: JQuery.Event) => {
    // do nothing if we are not dragging a piece
    if (!this.isDragging) return

    // prevent screen from scrolling
    evt.preventDefault()

    const changedTouches = evt.changedTouches;
    if (changedTouches) {
      this.updateDraggedPiece(changedTouches[0].pageX, changedTouches[0].pageY)
    }
  }



  private mouseupWindow = (evt: JQuery.Event) => {
    // do nothing if we are not dragging a piece
    if (!this.isDragging || !this.draggedPiece || !this.draggedPieceSource) return

    // get the location
    var location = this.isXYOnSquare(evt.pageX, evt.pageY)

    this.stopDraggedPiece(location, this.draggedPieceSource, this.draggedPiece)
  }

  private touchendWindow = (evt: JQuery.Event) => {
    // do nothing if we are not dragging a piece
    if (!this.isDragging || !this.draggedPiece || !this.draggedPieceSource) return

    const changedTouches = evt.changedTouches;
    if (!changedTouches) {
      return;
    }

    // get the location
    var location = this.isXYOnSquare(changedTouches[0].pageX, changedTouches[0].pageY)

    this.stopDraggedPiece(location, this.draggedPieceSource, this.draggedPiece)
  }

  private mouseenterSquare = (evt: JQuery.Event) => {
    // do not fire this event if we are dragging a piece
    // NOTE: this should never happen, but it's a safeguard
    if (this.isDragging) return

    // exit if they did not provide a onMouseoverSquare function
    if (!_.isFunction(this.config.onMouseoverSquare)) return

    if (evt.currentTarget === null) {
      return;
    }

    // get the square
    var square = $(evt.currentTarget).attr('data-square')

    // NOTE: this should never happen; defensive
    if (!validSquare(square)) return

    // get the piece on this square
    var piece: ColoredPieceCode | undefined;
    if (this.currentPosition.hasOwnProperty(square)) {
      piece = this.currentPosition[square]
    }

    // execute their function
    this.config.onMouseoverSquare(square, !!piece, this.deepCopy(this.currentPosition), this.currentOrientation)
  }

  private mouseleaveSquare = (evt: JQuery.Event) => {
    // do not fire this event if we are dragging a piece
    // NOTE: this should never happen, but it's a safeguard
    if (this.isDragging) return

    // exit if they did not provide an onMouseoutSquare function
    if (!_.isFunction(this.config.onMouseoutSquare)) return

    if (evt.currentTarget === null) {
      return;
    }
    // get the square
    var square = $(evt.currentTarget).attr('data-square')

    // NOTE: this should never happen; defensive
    if (square === undefined || !validSquare(square)) return

    // get the piece on this square
    var piece: ColoredPieceCode | undefined;
    if (this.currentPosition.hasOwnProperty(square)) {
      piece = this.currentPosition[square]
    }

    // execute their function
    this.config.onMouseoutSquare(square, piece, this.deepCopy(this.currentPosition), this.currentOrientation)
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  private addEvents() {
    // prevent "image drag"
    $('body').on('mousedown mousemove', '.' + CssConstants.piece, this.stopDefault)

    // mouse drag pieces
    this.$board.on('mousedown', '.' + CssConstants.square, this.mousedownSquare)
    this.$container.on('mousedown', '.' + CssConstants.sparePieces + ' .' + CssConstants.piece, this.mousedownSparePiece)

    // mouse enter / leave square
    this.$board
      .on('mouseenter', '.' + CssConstants.square, this.mouseenterSquare)
      .on('mouseleave', '.' + CssConstants.square, this.mouseleaveSquare)

    // piece drag
    var $window = $(window)
    $window
      .on('mousemove', this.throttledMousemoveWindow)
      .on('mouseup', this.mouseupWindow)

    // touch drag pieces
    if (this.isTouchDevice()) {
      this.$board.on("touchstart", '.' + CssConstants.square, this.touchstartSquare)
      this.$container.on('touchstart', '.' + CssConstants.sparePieces + ' .' + CssConstants.piece, this.touchstartSparePiece)
      $window
        .on('touchmove', this.throttledTouchmoveWindow)
        .on('touchend', this.touchendWindow)
    }
  }

  private initDOM() {
    // create unique IDs for all the elements we will create
    this.createElIds()

    // build board and save it in memory
    this.$container.html(this.buildContainerHTML(this.config.sparePieces))
    this.$board = this.$container.find('.' + CssConstants.board)

    if (this.config.sparePieces) {
      this.$sparePiecesTop = this.$container.find('.' + CssConstants.sparePiecesTop)
      this.$sparePiecesBottom = this.$container.find('.' + CssConstants.sparePiecesBottom)
    }

    // create the drag piece
    var draggedPieceId = this.uuid()
    $('body').append(this.buildPieceHTML('wP', true, draggedPieceId))
    this.$draggedPiece = $('#' + draggedPieceId)
    this.$draggedPiece.css("display", "none");
    this.$draggedPiece.addClass("dragging");

    // TODO: need to remove this dragged piece element if the board is no longer in the DOM

    // get the border size
    this.boardBorderSize = parseInt(this.$board.css('borderLeftWidth'), 10)

    // set the size and draw the board
    this.resize()
  }
}