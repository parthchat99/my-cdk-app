import {
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

export const handler = async () => {
  const plantsData = await ddb.send(
    new ScanCommand({ TableName: process.env.PLANTS_TABLE })
  );
  const vaccinesData = await ddb.send(
    new ScanCommand({ TableName: process.env.VACCINES_TABLE })
  );

  const vaccineMap = Object.fromEntries(
    (vaccinesData.Items ?? []).map((v) => [v.vaccineId, v.name])
  );

  const result = (plantsData.Items ?? []).map((p) => ({
    plant_id: p.plantId,
    location: p.location,
    vaccine_name: vaccineMap[p.vaccineId] || 'Unknown',
  }));

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
};
