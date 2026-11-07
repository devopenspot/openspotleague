/**
 * OpenSpot League email notifications (docs/notifications.md).
 *
 *   Worker ──SendMessage──▶ SQS FIFO ──▶ email-sender λ ──▶ SES v2
 *                              │ 5 tries                     │ bounce/complaint
 *                              ▼                             ▼
 *                             DLQ ──▶ alarm ──▶ SNS ──▶ admin email
 *                                               SNS ──▶ ses-events λ ──▶ Worker
 *   EventBridge Scheduler (15 min) ──▶ tick λ ──▶ Worker /api/internal/notifications/tick
 *
 * Everything here sits in the AWS always-free tier at League scale except
 * SES (3,000 msgs/month free for the first 12 months, then $0.10 / 1,000).
 * Secrets are not in this template: the internal HMAC secret is an SSM
 * SecureString created by hand, and the Worker's access key is created by
 * hand for the `osl-worker-notify` user.
 */

import * as path from "node:path"
import { fileURLToPath } from "node:url"
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib"
import * as budgets from "aws-cdk-lib/aws-budgets"
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch"
import * as cwActions from "aws-cdk-lib/aws-cloudwatch-actions"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { SqsEventSource, SnsEventSource } from "aws-cdk-lib/aws-lambda-event-sources"
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs"
import * as logs from "aws-cdk-lib/aws-logs"
import * as scheduler from "aws-cdk-lib/aws-scheduler"
import * as ses from "aws-cdk-lib/aws-ses"
import * as sns from "aws-cdk-lib/aws-sns"
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions"
import * as sqs from "aws-cdk-lib/aws-sqs"
import type { Construct } from "constructs"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const INFRA_ROOT = path.resolve(HERE, "..")
const REPO_ROOT = path.resolve(INFRA_ROOT, "../..")

export const INTERNAL_SECRET_PARAM = "/openspot/notifications/internal-secret"

export interface NotificationsStackProps extends StackProps {
  /** Verified SES domain, e.g. `mail.openspotleague.com`. */
  sendingDomain: string
  /** `OpenSpot League <no-reply@mail.openspotleague.com>` */
  fromAddress: string
  /** Public Worker origin the Lambdas call back. */
  appUrl: string
  /** Receives DLQ alarms and the budget alert. */
  alertEmail: string
  monthlyBudgetUsd: number
}

export class NotificationsStack extends Stack {
  constructor(scope: Construct, id: string, props: NotificationsStackProps) {
    super(scope, id, props)

    // ---------- queue ----------
    const dlq = new sqs.Queue(this, "EmailDlq", {
      queueName: "osl-notify-email-dlq.fifo",
      fifo: true,
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    })
    const queue = new sqs.Queue(this, "EmailQueue", {
      queueName: "osl-notify-email.fifo",
      fifo: true,
      contentBasedDeduplication: false,
      // 6× the sender timeout, per the Lambda + SQS guidance.
      visibilityTimeout: Duration.seconds(180),
      retentionPeriod: Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: { queue: dlq, maxReceiveCount: 5 },
    })

    // ---------- idempotency ----------
    const idempotency = new dynamodb.Table(this, "EmailIdempotency", {
      tableName: "osl-notify-email-idempotency",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expiration",
      removalPolicy: RemovalPolicy.DESTROY,
    })

    // ---------- SES ----------
    const feedbackTopic = new sns.Topic(this, "SesFeedback", { topicName: "osl-notify-ses-feedback" })
    const configurationSet = new ses.ConfigurationSet(this, "ConfigSet", {
      configurationSetName: "osl-notify",
      reputationMetrics: true,
      suppressionReasons: ses.SuppressionReasons.BOUNCES_AND_COMPLAINTS,
    })
    configurationSet.addEventDestination("Feedback", {
      destination: ses.EventDestination.snsTopic(feedbackTopic),
      events: [ses.EmailSendingEvent.BOUNCE, ses.EmailSendingEvent.COMPLAINT],
    })
    const identity = new ses.EmailIdentity(this, "Domain", {
      identity: ses.Identity.domain(props.sendingDomain),
      mailFromDomain: `bounce.${props.sendingDomain}`,
      configurationSet,
    })

    // ---------- functions ----------
    const internalSecretArn = Stack.of(this).formatArn({
      service: "ssm",
      resource: "parameter",
      resourceName: INTERNAL_SECRET_PARAM.replace(/^\//, ""),
    })
    const readSecret = new iam.PolicyStatement({
      actions: ["ssm:GetParameter"],
      resources: [internalSecretArn],
    })
    const common: Omit<nodejs.NodejsFunctionProps, "entry"> = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(30),
      projectRoot: REPO_ROOT,
      depsLockFilePath: path.join(INFRA_ROOT, "pnpm-lock.yaml"),
      bundling: {
        format: nodejs.OutputFormat.ESM,
        target: "node22",
        minify: true,
        sourceMap: true,
        // AWS SDK v3 ships in the Node 22 runtime.
        externalModules: ["@aws-sdk/*"],
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
      environment: {
        APP_URL: props.appUrl,
        INTERNAL_SECRET_PARAM,
        NODE_OPTIONS: "--enable-source-maps",
      },
    }
    const logGroup = (name: string) =>
      new logs.LogGroup(this, `${name}Logs`, {
        logGroupName: `/aws/lambda/osl-notify-${name}`,
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      })

    const sender = new nodejs.NodejsFunction(this, "EmailSender", {
      ...common,
      functionName: "osl-notify-email-sender",
      entry: path.join(INFRA_ROOT, "lambdas/email-sender.ts"),
      logGroup: logGroup("email-sender"),
      environment: {
        ...common.environment,
        FROM_ADDRESS: props.fromAddress,
        CONFIGURATION_SET: configurationSet.configurationSetName,
        IDEMPOTENCY_TABLE: idempotency.tableName,
      },
    })
    sender.addEventSource(
      new SqsEventSource(queue, {
        batchSize: 10,
        reportBatchItemFailures: true,
        // Minimum allowed; keeps SES under its sending rate.
        maxConcurrency: 2,
      }),
    )
    idempotency.grantReadWriteData(sender)
    sender.addToRolePolicy(readSecret)
    sender.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail"],
        resources: [
          `arn:aws:ses:${this.region}:${this.account}:identity/${props.sendingDomain}`,
          `arn:aws:ses:${this.region}:${this.account}:configuration-set/${configurationSet.configurationSetName}`,
        ],
      }),
    )
    sender.node.addDependency(identity)

    const tick = new nodejs.NodejsFunction(this, "Tick", {
      ...common,
      functionName: "osl-notify-tick",
      entry: path.join(INFRA_ROOT, "lambdas/tick.ts"),
      timeout: Duration.seconds(60),
      logGroup: logGroup("tick"),
    })
    tick.addToRolePolicy(readSecret)

    const sesEvents = new nodejs.NodejsFunction(this, "SesEvents", {
      ...common,
      functionName: "osl-notify-ses-events",
      entry: path.join(INFRA_ROOT, "lambdas/ses-events.ts"),
      logGroup: logGroup("ses-events"),
    })
    sesEvents.addToRolePolicy(readSecret)
    sesEvents.addEventSource(new SnsEventSource(feedbackTopic))

    // ---------- 15-minute tick ----------
    const schedulerRole = new iam.Role(this, "TickSchedulerRole", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    })
    tick.grantInvoke(schedulerRole)
    new scheduler.CfnSchedule(this, "TickSchedule", {
      name: "osl-notify-tick",
      description: "OpenSpot notification tick: reminders, backstop, digests",
      scheduleExpression: "rate(15 minutes)",
      flexibleTimeWindow: { mode: "OFF" },
      target: {
        arn: tick.functionArn,
        roleArn: schedulerRole.roleArn,
        retryPolicy: { maximumRetryAttempts: 0 },
      },
    })

    // ---------- Worker producer identity ----------
    const workerUser = new iam.User(this, "WorkerProducer", { userName: "osl-worker-notify" })
    workerUser.addToPolicy(
      new iam.PolicyStatement({ actions: ["sqs:SendMessage"], resources: [queue.queueArn] }),
    )

    // ---------- alarms + budget ----------
    const alerts = new sns.Topic(this, "Alerts", { topicName: "osl-notify-alerts" })
    alerts.addSubscription(new subscriptions.EmailSubscription(props.alertEmail))
    const dlqAlarm = new cloudwatch.Alarm(this, "DlqNotEmpty", {
      alarmName: "osl-notify-email-dlq-not-empty",
      alarmDescription: "Emails failed 5 times and landed in the DLQ (docs/notifications.md runbook).",
      metric: dlq.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) }),
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    })
    dlqAlarm.addAlarmAction(new cwActions.SnsAction(alerts))

    new budgets.CfnBudget(this, "MonthlyBudget", {
      budget: {
        budgetName: "osl-notify-monthly",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: props.monthlyBudgetUsd, unit: "USD" },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold: 50,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [{ subscriptionType: "EMAIL", address: props.alertEmail }],
        },
      ],
    })

    // ---------- outputs ----------
    new CfnOutput(this, "QueueUrl", {
      value: queue.queueUrl,
      description: "NOTIFY_EMAIL_QUEUE_URL for the Worker",
    })
    new CfnOutput(this, "WorkerUserName", {
      value: workerUser.userName,
      description: "Create an access key for this user: AWS_NOTIFY_ACCESS_KEY_ID / AWS_NOTIFY_SECRET_ACCESS_KEY",
    })
    identity.dkimRecords.forEach((record, index) => {
      new CfnOutput(this, `DkimRecord${index + 1}`, {
        value: `CNAME ${record.name} → ${record.value}`,
        description: "Add in Cloudflare DNS (DNS only, not proxied)",
      })
    })
    new CfnOutput(this, "MailFromRecords", {
      value: `MX bounce.${props.sendingDomain} → 10 feedback-smtp.${this.region}.amazonses.com ; TXT bounce.${props.sendingDomain} → "v=spf1 include:amazonses.com ~all"`,
      description: "Custom MAIL FROM records (Cloudflare DNS, DNS only)",
    })
  }
}
