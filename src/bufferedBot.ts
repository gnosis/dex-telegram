import TelegramBot from 'node-telegram-bot-api'
import {
  Subject,
  of,
  timer,
  EMPTY,
  throwError,
} from 'rxjs'
import {
  bufferTime,
  filter,
  groupBy,
  mergeMap,
  concatMap,
  switchMap,
  ignoreElements,
  startWith,
  retryWhen,
  delayWhen,
  delay,
  map,
  tap,
  catchError,
} from 'rxjs/operators'

import { SendMessageInput, concatMessages } from 'helpers'
import { Logger } from '@gnosis.pm/dex-js'

const log = new Logger('bot:buffered')

const BUFFER_TIME = 3000 // consecutive messages over this time get buffered, ms
const SPACE_TIME = 1000 // min time between sending messages, ms
const DEFAULT_RETRY_DELAY = 5 // retry delay when error message doesn't suggest it, sec
const MAX_RETRIES = 5 // give up on a message after so many retries

const RETRY_IN_REGEXP = /\bretry after (\d+)/ // to extract recommended delay from
// 'Too Many Requests: retry in N' error message

// sendMessage buffers messages and sends them in batches
export class BufferedBot extends TelegramBot {
  private messagesSubject$ = new Subject<SendMessageInput>()

  constructor(token: string, options?: TelegramBot.ConstructorOptions) {
    super(token, options)

    this.messagesSubject$.asObservable().pipe(
      // group messages by chatId
      // in case we have more channels
      groupBy(messageInput => messageInput.chatId),
      mergeMap(group$ => group$.pipe(
        // buffer messages for N seconds
        bufferTime(BUFFER_TIME),
        // pass forth only non-empty arrays
        filter(array => array.length > 0),
      )),
      // here all messages in the array belong to the same chatId
      mergeMap(messageIputArray => {
        // concat many messages into one
        return concatMessages(messageIputArray)
      }),
      // if multiple compound messages coming through
      // space them out by M seconds
      concatMap(compoundMessage => timer(SPACE_TIME).pipe(
        ignoreElements(),
        startWith(compoundMessage),
        mergeMap(compoundMessage => {
          log.debug('Sending compound message %o', compoundMessage)

          const { chatId, text, options } = compoundMessage

          return super.sendMessage(chatId, text, { ...options }) // {...hack} because bot mutates options
        }),
        retryWhen(error$ =>
          error$.pipe(
            switchMap((error: Error, index) => {
              // on MAX_RETRIES error -- skip this unfortunate message
              log.error('Error sending message:', error.message)
              if (index === MAX_RETRIES) {
                log.error('Maximum retries of', MAX_RETRIES, 'reached')
                log.error('Message %o will not be sent', compoundMessage)
                // rethrow error
                return throwError(error)
              }

              // pass the error on
              return of(error)
            }),
            map(error => {
              // if error is 'Too Many Requests: retry in N'
              const errorMatch = error.message.match(RETRY_IN_REGEXP)
              const delaySec = errorMatch ? parseInt(errorMatch[1], 10) : DEFAULT_RETRY_DELAY
              // or in DEFAULT_RETRY_DELAY seconds

              log.error('Retrying in', delaySec, 'seconds')

              return delaySec * 1000
            }),
            // delay between retries
            delayWhen(delayMs => timer(delayMs)),
            tap(() => log.error('Retrying now')),
            // catch rethrown error
            // and close pipe for this message
            // after giving some delay before next compoundMessage
            // on top of usual spacing
            catchError(() => EMPTY.pipe(delay(SPACE_TIME))),
          ),
        ),
      )),
    ).subscribe(() => {
      log.debug('Message sent successfully')
    },
    log.errorHandler,
    () => console.log('COMPLETE'),
    )
  }

  // have to return any to respect TelegramBot.sendMessage type
  sendMessage(chatId: number | string, text: string, options?: TelegramBot.SendMessageOptions): any {
    this.messagesSubject$.next({
      chatId,
      text,
      options,
    })
  }
}
