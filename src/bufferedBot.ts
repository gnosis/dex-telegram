import TelegramBot from 'node-telegram-bot-api'
import { Subject, timer } from 'rxjs'
import { bufferTime, filter, groupBy, mergeMap, concatMap, ignoreElements, startWith } from 'rxjs/operators'

import { SendMessageInput, concatMessages } from 'helpers'
import { Logger } from '@gnosis.pm/dex-js'

const log = new Logger('bot:buffered')

const BUFFER_TIME = 3000 // consecutive messages over this time get buffered
const SPACE_TIME = 1000 // min time between sending messages

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
      )),
    ).subscribe(compoundMessage => {
      log.debug('Sending compound message %o', compoundMessage)

      const { chatId, text, options } = compoundMessage

      super.sendMessage(chatId, text, options)
    })
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
