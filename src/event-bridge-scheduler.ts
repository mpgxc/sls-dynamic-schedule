import {
  DeleteRuleCommand,
  EventBridgeClient,
  ListRulesCommand,
  PutRuleCommand,
  PutTargetsCommand,
  RemoveTargetsCommand,
} from "@aws-sdk/client-eventbridge";
import {
  AddPermissionCommand,
  LambdaClient,
  RemovePermissionCommand,
} from "@aws-sdk/client-lambda";

type EventRule = {
  payload: Record<string, any>;
  lambdaArn: string;
  ruleState?: "ENABLED" | "DISABLED";
  ruleName: string;
  scheduleExpression?: string;
};

export class EventBridgeService {
  private readonly eventBridgeClient: EventBridgeClient;
  private readonly lambdaClient: LambdaClient;

  constructor() {
    this.eventBridgeClient = new EventBridgeClient({});
    this.lambdaClient = new LambdaClient({});
  }

  private async createRule(
    ruleName: string,
    ruleState: EventRule["ruleState"],
    scheduleExpression?: string
  ) {
    const command = new PutRuleCommand({
      Name: ruleName,
      State: ruleState || "ENABLED",
      ScheduleExpression: scheduleExpression,
    });
    return this.eventBridgeClient.send(command);
  }

  private async createLambdaTrigger(
    lambdaArn: string,
    functionName: string,
    ruleName: string
  ) {
    const command = new AddPermissionCommand({
      Action: "lambda:InvokeFunction",
      Principal: "events.amazonaws.com",
      SourceArn: lambdaArn,
      StatementId: ruleName,
      FunctionName: functionName,
    });
    return this.lambdaClient.send(command);
  }

  private async setLambdaToRule(
    ruleName: string,
    functionName: string,
    lambdaArn: string,
    payload: any
  ) {
    const command = new PutTargetsCommand({
      Rule: ruleName,
      Targets: [
        {
          Id: functionName,
          Arn: lambdaArn,
          Input: JSON.stringify({ ...payload, ruleName }),
        },
      ],
    });
    return this.eventBridgeClient.send(command);
  }

  private async getRulesByPrefix(initialRuleName: string) {
    const command = new ListRulesCommand({ NamePrefix: initialRuleName });
    const { Rules } = await this.eventBridgeClient.send(command);
    return Rules || [];
  }

  private getFunctionName(arn: string) {
    return arn.split(":").reverse()[0];
  }

  private async deleteLambdaPermission(ruleName: string, lambdaArn: string) {
    const functionName = this.getFunctionName(lambdaArn);
    const command = new RemovePermissionCommand({
      FunctionName: functionName,
      StatementId: ruleName,
    });
    return this.lambdaClient.send(command);
  }

  private async deleteRuleTargets(ruleName: string, lambdaArn: string) {
    const functionName = this.getFunctionName(lambdaArn);
    const command = new RemoveTargetsCommand({
      Rule: ruleName,
      Ids: [functionName],
    });
    return this.eventBridgeClient.send(command);
  }

  private async deleteRule(ruleName: string) {
    const command = new DeleteRuleCommand({ Name: ruleName });
    return this.eventBridgeClient.send(command);
  }

  private async defineRuleName(initialRuleName: string) {
    const rules = await this.getRulesByPrefix(initialRuleName);
    return `${initialRuleName}${rules.length ? rules.length + 1 : 1}`;
  }

  async createSchedulePipeline({
    payload,
    ruleState,
    lambdaArn,
    ruleName,
    scheduleExpression,
  }: EventRule) {
    const functionName = this.getFunctionName(lambdaArn);
    const newRuleName = await this.defineRuleName(ruleName);

    try {
      const { $metadata, RuleArn } = await this.createRule(
        newRuleName,
        ruleState,
        scheduleExpression
      );

      if (
        !$metadata?.httpStatusCode ||
        $metadata.httpStatusCode !== 200 ||
        !RuleArn
      ) {
        throw new Error("Rule not created");
      }

      await this.createLambdaTrigger(RuleArn, functionName, newRuleName);
      await this.setLambdaToRule(newRuleName, functionName, lambdaArn, payload);
    } catch (error) {
      console.error(error);
    }
  }

  async deleteRulePipeline(ruleName: string, lambdaArn: string) {
    await this.deleteLambdaPermission(ruleName, lambdaArn);
    await this.deleteRuleTargets(ruleName, lambdaArn);
    await this.deleteRule(ruleName);
  }
}
