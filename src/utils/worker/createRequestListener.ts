import {
  StartOptions,
  SerializedResponse,
  SetupWorkerInternalContext,
  ServiceWorkerIncomingEventsMap,
} from '../../setupWorker/glossary'
import {
  ServiceWorkerMessage,
  createBroadcastChannel,
} from '../createBroadcastChannel'
import { NetworkError } from '../NetworkError'
import { parseWorkerRequest } from '../request/parseWorkerRequest'
import { handleRequest } from '../handleRequest'
import { RequestHandler } from '../../handlers/RequestHandler'

export const createRequestListener = (
  context: SetupWorkerInternalContext,
  options: StartOptions,
) => {
  console.log('createRequestListener:20')
  return async (
    event: MessageEvent,
    message: ServiceWorkerMessage<
      'REQUEST',
      ServiceWorkerIncomingEventsMap['REQUEST']
    >,
  ) => {
    console.log('createRequestListener:28')
    const channel = createBroadcastChannel(event)

    try {
      const request = parseWorkerRequest(message.payload)
      await handleRequest<SerializedResponse>(
        request,
        context.requestHandlers,
        options,
        context.emitter,
        {
          transformResponse(response) {
            console.log('createRequestListener:40')
            return {
              ...response,
              headers: response.headers.all(),
            }
          },
          onBypassResponse() {
            console.log('createRequestListener:47')
            return channel.send({
              type: 'MOCK_NOT_FOUND',
            })
          },
          onMockedResponse(response) {
            console.log('createRequestListener:53')
            channel.send({
              type: 'MOCK_SUCCESS',
              payload: response,
            })
          },
          onMockedResponseSent(
            response,
            { handler, publicRequest, parsedRequest },
          ) {
            console.log('createRequestListener:63')
            if (!options.quiet) {
              handler.log(
                publicRequest,
                response,
                handler as RequestHandler,
                parsedRequest,
              )
            }
          },
        },
      )
    } catch (error) {
      console.log('createRequestListener:76')
      if (error instanceof NetworkError) {
        console.log('createRequestListener:78')
        // Treat emulated network error differently,
        // as it is an intended exception in a request handler.
        return channel.send({
          type: 'NETWORK_ERROR',
          payload: {
            name: error.name,
            message: error.message,
          },
        })
      }
      console.log('createRequestListener:89')
      // Treat all the other exceptions in a request handler
      // as unintended, alerting that there is a problem needs fixing.
      channel.send({
        type: 'INTERNAL_ERROR',
        payload: {
          status: 500,
          body: JSON.stringify({
            errorType: error.constructor.name,
            message: error.message,
            location: error.stack,
          }),
        },
      })
    }
  }
}
