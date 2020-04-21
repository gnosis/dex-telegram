import TelegramBot from 'node-telegram-bot-api'
import { Subject, timer } from 'rxjs'
import { bufferTime, filter, groupBy, mergeMap, concatMap, ignoreElements, startWith } from 'rxjs/operators'

import { SendMessageInput, concatMessages } from 'helpers'

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
        // buffer messages for 6sec
        bufferTime(6000),
        // pass forth only non-empty arrays
        filter(array => array.length > 0),
      )),
      // here all messages in the array belong to the same chatId
      mergeMap(messageIputArray => {
        // concat many messages into one
        return concatMessages(messageIputArray)
      }),
      // if multiple compound messages coming through
      // space them out by 1sec
      concatMap(compoundMessage => timer(1000).pipe(
        ignoreElements(),
        startWith(compoundMessage),
      )),
    ).subscribe(compoundMessage => {
      console.log('compoundMessage', compoundMessage)

      const { chatId, text, options } = compoundMessage
      console.log('text', text.length)

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
