import {
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

export const handler = async (event: any) => {
  try {
    console.log('📥 Received event:', JSON.stringify(event));

    // ⛔ Exclude checksum entries using FilterExpression
    const plantsData = await ddb.send(
      new ScanCommand({
        TableName: process.env.PLANTS_TABLE,
        FilterExpression: 'NOT begins_with(plantId, :prefix)',
        ExpressionAttributeValues: {
          ':prefix': 'checksum_',
        },
      })
    );

    const vaccinesData = await ddb.send(
      new ScanCommand({ TableName: process.env.VACCINES_TABLE })
    );

    // 🧠 Create a lookup map for vaccineId → vaccine name
    const vaccineMap = Object.fromEntries(
      (vaccinesData.Items ?? [])
        .filter((v) => v?.vaccineId && v?.name)
        .map((v) => [v.vaccineId, v.name])
    );

    // 🏗️ Build final result
    const result = (plantsData.Items ?? []).map((p) => ({
      plant_id: p.plantId,
      location: p.location,
      vaccine_name: vaccineMap[p.vaccineId] || 'Unknown',
    }));

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error('❌ Error in GET handler:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error', error: err }),
    };
  }
};
