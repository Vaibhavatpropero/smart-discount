import json
from pathlib import Path
import re

# Helper to create node IDs
def make_id(stem, entity):
    stem_clean = stem.replace('\\\\', '/').replace('/', '_').replace('-', '_').replace('.', '_').lower()
    entity_clean = re.sub(r'[^a-z0-9_]', '_', entity.lower())
    return f'{stem_clean}_{entity_clean}'

# Process README.md
readme_path = r'D:\Dev\Propero_WP\Smart-Discount\Smart Discount 16-06\sd-dev\README.md'
readme_stem = 'readme'

readme_nodes = [
    {'id': make_id(readme_stem, 'shopify_app_template_react_router'), 'label': 'Shopify App Template React Router', 'file_type': 'document', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'shopify_app_template_remix'), 'label': 'Shopify App Template Remix', 'file_type': 'document', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'react_router'), 'label': 'React Router', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'shopify_cli'), 'label': 'Shopify CLI', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'shopify_auth'), 'label': 'Shopify Authentication', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'graphql_admin_api'), 'label': 'GraphQL Admin API', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'prisma'), 'label': 'Prisma ORM', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'sqlite_database'), 'label': 'SQLite Database', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'session_storage'), 'label': 'Session Storage', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'metafields_metaobjects'), 'label': 'Metafields and Metaobjects', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'declarative_custom_data'), 'label': 'Declarative Custom Data', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'shopify_dev_mcp'), 'label': 'Shopify Dev MCP', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'google_cloud_run'), 'label': 'Google Cloud Run', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'fly_io'), 'label': 'Fly.io', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'render'), 'label': 'Render', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'docker_deployment'), 'label': 'Docker Deployment', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'webhooks'), 'label': 'Webhooks', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'app_bridge'), 'label': 'App Bridge', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'polaris'), 'label': 'Polaris Design System', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'app_extensions'), 'label': 'App Extensions', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'shopify_functions'), 'label': 'Shopify Functions', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(readme_stem, 'internationalization'), 'label': 'Internationalization', 'file_type': 'concept', 'source_file': readme_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
]

readme_edges = [
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'shopify_app_template_remix'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'react_router'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'shopify_cli'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'shopify_auth'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'graphql_admin_api'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'prisma'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'sqlite_database'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'session_storage'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'metafields_metaobjects'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'declarative_custom_data'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'shopify_dev_mcp'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'google_cloud_run'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'fly_io'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'render'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'docker_deployment'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'webhooks'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'app_bridge'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'polaris'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'app_extensions'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'shopify_functions'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(readme_stem, 'shopify_app_template_react_router'), 'target': make_id(readme_stem, 'internationalization'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': readme_path, 'source_location': None, 'weight': 1.0},
]

readme_hyperedges = [
    {'id': make_id(readme_stem, 'template_features'), 'label': 'Template Features', 'nodes': [make_id(readme_stem, 'shopify_app_template_react_router'), make_id(readme_stem, 'react_router'), make_id(readme_stem, 'shopify_cli'), make_id(readme_stem, 'graphql_admin_api'), make_id(readme_stem, 'prisma')], 'relation': 'form', 'confidence': 'EXTRACTED', 'confidence_score': 0.75, 'source_file': readme_path},
    {'id': make_id(readme_stem, 'deployment_options'), 'label': 'Deployment Options', 'nodes': [make_id(readme_stem, 'google_cloud_run'), make_id(readme_stem, 'fly_io'), make_id(readme_stem, 'render'), make_id(readme_stem, 'docker_deployment')], 'relation': 'form', 'confidence': 'EXTRACTED', 'confidence_score': 0.75, 'source_file': readme_path},
]

# Process env.example.txt
env_path = r'D:\Dev\Propero_WP\Smart-Discount\Smart Discount 16-06\sd-dev\env.example.txt'
env_stem = 'env_example'

env_nodes = [
    {'id': make_id(env_stem, 'shopify_api_config'), 'label': 'Shopify API Configuration', 'file_type': 'document', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'shopify_api_key'), 'label': 'SHOPIFY_API_KEY', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'shopify_api_secret'), 'label': 'SHOPIFY_API_SECRET', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'scopes'), 'label': 'SCOPES', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'shopify_app_url'), 'label': 'SHOPIFY_APP_URL', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'database_config'), 'label': 'Database Configuration', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'local_database_url'), 'label': 'LOCAL_DATABASE_URL', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'database_url'), 'label': 'DATABASE_URL', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'aws_credentials'), 'label': 'AWS Credentials', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'aws_region'), 'label': 'AWS_REGION', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'ec2_config'), 'label': 'EC2 Configuration', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'ec2_user'), 'label': 'EC2_USER', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'ec2_host'), 'label': 'EC2_HOST', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'ec2_ssh_key'), 'label': 'EC2_SSH_KEY', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'aws_iam'), 'label': 'AWS IAM for GH Bot', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'aws_access_key'), 'label': 'AWS_ACCESS_KEY_ID', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'aws_secret_key'), 'label': 'AWS_SECRET_ACCESS_KEY', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'aws_ecr'), 'label': 'AWS ECR', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'aws_ecr_uri'), 'label': 'AWS_ECR_URI', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(env_stem, 'aws_container_name'), 'label': 'AWS_CONTAINER_NAME', 'file_type': 'concept', 'source_file': env_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
]

env_edges = [
    {'source': make_id(env_stem, 'shopify_api_config'), 'target': make_id(env_stem, 'shopify_api_key'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'shopify_api_config'), 'target': make_id(env_stem, 'shopify_api_secret'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'shopify_api_config'), 'target': make_id(env_stem, 'scopes'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'shopify_api_config'), 'target': make_id(env_stem, 'shopify_app_url'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'database_config'), 'target': make_id(env_stem, 'local_database_url'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'database_config'), 'target': make_id(env_stem, 'database_url'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'aws_credentials'), 'target': make_id(env_stem, 'aws_region'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'aws_credentials'), 'target': make_id(env_stem, 'ec2_config'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'ec2_config'), 'target': make_id(env_stem, 'ec2_user'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'ec2_config'), 'target': make_id(env_stem, 'ec2_host'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'ec2_config'), 'target': make_id(env_stem, 'ec2_ssh_key'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'aws_credentials'), 'target': make_id(env_stem, 'aws_iam'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'aws_iam'), 'target': make_id(env_stem, 'aws_access_key'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'aws_iam'), 'target': make_id(env_stem, 'aws_secret_key'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'aws_credentials'), 'target': make_id(env_stem, 'aws_ecr'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'aws_ecr'), 'target': make_id(env_stem, 'aws_ecr_uri'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(env_stem, 'aws_ecr'), 'target': make_id(env_stem, 'aws_container_name'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': env_path, 'source_location': None, 'weight': 1.0},
]

env_hyperedges = [
    {'id': make_id(env_stem, 'env_sections'), 'label': 'Environment Configuration Sections', 'nodes': [make_id(env_stem, 'shopify_api_config'), make_id(env_stem, 'database_config'), make_id(env_stem, 'aws_credentials')], 'relation': 'form', 'confidence': 'EXTRACTED', 'confidence_score': 0.75, 'source_file': env_path},
]

# Combine for chunk 3
chunk3 = {
    'nodes': readme_nodes + env_nodes,
    'edges': readme_edges + env_edges,
    'hyperedges': readme_hyperedges + env_hyperedges,
    'input_tokens': 0,
    'output_tokens': 0,
}

Path('graphify-out/.graphify_chunk_03.json').write_text(json.dumps(chunk3, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Chunk 3: {len(chunk3["nodes"])} nodes, {len(chunk3["edges"])} edges, {len(chunk3["hyperedges"])} hyperedges')