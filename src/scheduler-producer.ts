import {
  CreateScheduleCommand,
  SchedulerClient,
} from "@aws-sdk/client-scheduler";
import { randomBytes, randomUUID } from "node:crypto";

const client = new SchedulerClient({
  region: "us-east-1",
});

export interface TaskSchedulerProducer {
  handle(): Promise<any>;
}

export class TaskSchedulerProducerImpl implements TaskSchedulerProducer {
  constructor() {}

  async handle(): Promise<any> {
    const command = new CreateScheduleCommand({
      Name: "my-schedule" + Math.random().toString(),
      Description: "A Simple Scheduler Task",
      State: "ENABLED",
      ScheduleExpression: "rate(1 minutes)",
      ScheduleExpressionTimezone: "UTC",
      ClientToken: randomUUID(),
      FlexibleTimeWindow: {
        Mode: "OFF",
      },
      Target: {
        Arn: process.env.QUEUE_ARN!,
        RoleArn: process.env.SCHEDULER_ROLE_ARN!,
        SqsParameters: {
          MessageGroupId: "my-group",
        },
        Input: JSON.stringify({
          task: "daaale " + randomBytes(4).toString("hex"),
        }),
      },
    });

    try {
      const result = await client.send(command);
      console.log("Success", result);

      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } catch (err) {
      console.log("Error", err);

      return {
        statusCode: 500,
        body: JSON.stringify(err),
      };
    }
  }
}

export const handler = new TaskSchedulerProducerImpl().handle;
