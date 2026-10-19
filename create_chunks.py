import json
from pathlib import Path
import re

# Helper to create node IDs
def make_id(stem, entity):
    stem_clean = stem.replace('\\\\', '/').replace('/', '_').replace('-', '_').replace('.', '_').lower()
    entity_clean = re.sub(r'[^a-z0-9_]', '_', entity.lower())
    return f'{stem_clean}_{entity_clean}'

# Process CHANGELOG.md
changelog_path = r'D:\Dev\Propero_WP\Smart-Discount\Smart Discount 16-06\sd-dev\CHANGELOG.md'
changelog_stem = 'changelog'

changelog_nodes = [
    {'id': make_id(changelog_stem, 'shopify_app_template_react_router'), 'label': 'Shopify App Template React Router', 'file_type': 'document', 'source_file': changelog_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(changelog_stem, 'shopify_app_template_remix'), 'label': 'Shopify App Template Remix', 'file_type': 'document', 'source_file': changelog_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(changelog_stem, 'calver'), 'label': 'Calendar Versioning (calver)', 'file_type': 'concept', 'source_file': changelog_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(changelog_stem, 'react_router_v7'), 'label': 'React Router v7', 'file_type': 'concept', 'source_file': changelog_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(changelog_stem, 'prisma_session_storage'), 'label': 'Prisma Session Storage', 'file_type': 'concept', 'source_file': changelog_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(changelog_stem, 'expiring_offline_tokens'), 'label': 'Expiring Offline Access Tokens', 'file_type': 'concept', 'source_file': changelog_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(changelog_stem, 'admin_intents'), 'label': 'Shopify Admin Intents', 'file_type': 'concept', 'source_file': changelog_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(changelog_stem, 'polaris_types'), 'label': 'Polaris Types', 'file_type': 'concept', 'source_file': changelog_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(changelog_stem, 'app_bridge_web_components'), 'label': 'App Bridge Web Components', 'file_type': 'concept', 'source_file': changelog_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(changelog_stem, 'vite_6'), 'label': 'Vite 6', 'file_type': 'concept', 'source_file': changelog_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(changelog_stem, 'shopify_dev_mcp'), 'label': 'Shopify Dev MCP', 'file_type': 'concept', 'source_file': changelog_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(changelog_stem, 'graphql_autocomplete'), 'label': 'GraphQL Autocomplete', 'file_type': 'concept', 'source_file': changelog_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(changelog_stem, 'webhook_processing'), 'label': 'Webhook Processing', 'file_type': 'concept', 'source_file': changelog_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(changelog_stem, 'remix_future_flags'), 'label': 'Remix Future Flags', 'file_type': 'concept', 'source_file': changelog_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
]

changelog_edges = [
    {'source': make_id(changelog_stem, 'shopify_app_template_react_router'), 'target': make_id(changelog_stem, 'shopify_app_template_remix'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': changelog_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(changelog_stem, 'shopify_app_template_react_router'), 'target': make_id(changelog_stem, 'calver'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': changelog_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(changelog_stem, 'shopify_app_template_react_router'), 'target': make_id(changelog_stem, 'react_router_v7'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': changelog_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(changelog_stem, 'shopify_app_template_react_router'), 'target': make_id(changelog_stem, 'prisma_session_storage'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': changelog_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(changelog_stem, 'shopify_app_template_react_router'), 'target': make_id(changelog_stem, 'expiring_offline_tokens'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': changelog_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(changelog_stem, 'shopify_app_template_react_router'), 'target': make_id(changelog_stem, 'admin_intents'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': changelog_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(changelog_stem, 'shopify_app_template_react_router'), 'target': make_id(changelog_stem, 'polaris_types'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': changelog_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(changelog_stem, 'shopify_app_template_react_router'), 'target': make_id(changelog_stem, 'app_bridge_web_components'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': changelog_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(changelog_stem, 'shopify_app_template_react_router'), 'target': make_id(changelog_stem, 'vite_6'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': changelog_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(changelog_stem, 'shopify_app_template_react_router'), 'target': make_id(changelog_stem, 'shopify_dev_mcp'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': changelog_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(changelog_stem, 'shopify_app_template_react_router'), 'target': make_id(changelog_stem, 'graphql_autocomplete'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': changelog_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(changelog_stem, 'shopify_app_template_react_router'), 'target': make_id(changelog_stem, 'webhook_processing'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': changelog_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(changelog_stem, 'shopify_app_template_react_router'), 'target': make_id(changelog_stem, 'remix_future_flags'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': changelog_path, 'source_location': None, 'weight': 1.0},
]

changelog_hyperedges = [
    {'id': make_id(changelog_stem, 'template_evolution'), 'label': 'Template Evolution History', 'nodes': [make_id(changelog_stem, 'shopify_app_template_react_router'), make_id(changelog_stem, 'shopify_app_template_remix'), make_id(changelog_stem, 'calver')], 'relation': 'form', 'confidence': 'EXTRACTED', 'confidence_score': 0.75, 'source_file': changelog_path},
]

# Process CLAUDE.md
claude_path = r'D:\Dev\Propero_WP\Smart-Discount\Smart Discount 16-06\sd-dev\CLAUDE.md'
claude_stem = 'claude'

claude_nodes = [
    {'id': make_id(claude_stem, 'sd_dev_project'), 'label': 'SD-Dev Project', 'file_type': 'document', 'source_file': claude_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(claude_stem, 'shopify_discount_app'), 'label': 'Shopify Discount App', 'file_type': 'concept', 'source_file': claude_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(claude_stem, 'react_router_vite_tailwind'), 'label': 'React Router Vite Tailwind Stack', 'file_type': 'concept', 'source_file': claude_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(claude_stem, 'prisma_database'), 'label': 'Prisma Database', 'file_type': 'concept', 'source_file': claude_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(claude_stem, 'shopify_functions'), 'label': 'Shopify Functions', 'file_type': 'concept', 'source_file': claude_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(claude_stem, 'capped_order_discount'), 'label': 'Capped Order Discount', 'file_type': 'concept', 'source_file': claude_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(claude_stem, 'free_gift_discount'), 'label': 'Free Gift Discount', 'file_type': 'concept', 'source_file': claude_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(claude_stem, 'discount_wizard'), 'label': 'Discount Creation Wizard', 'file_type': 'concept', 'source_file': claude_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(claude_stem, 'discount_sync'), 'label': 'Discount Sync with Shopify', 'file_type': 'concept', 'source_file': claude_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(claude_stem, 'billing_plans'), 'label': 'Billing and Plans', 'file_type': 'concept', 'source_file': claude_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(claude_stem, 'analytics'), 'label': 'Analytics', 'file_type': 'concept', 'source_file': claude_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
    {'id': make_id(claude_stem, 'graphify_integration'), 'label': 'Graphify Integration', 'file_type': 'concept', 'source_file': claude_path, 'source_location': None, 'source_url': None, 'captured_at': None, 'author': None, 'contributor': None},
]

claude_edges = [
    {'source': make_id(claude_stem, 'sd_dev_project'), 'target': make_id(claude_stem, 'shopify_discount_app'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': claude_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(claude_stem, 'sd_dev_project'), 'target': make_id(claude_stem, 'react_router_vite_tailwind'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': claude_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(claude_stem, 'sd_dev_project'), 'target': make_id(claude_stem, 'prisma_database'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': claude_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(claude_stem, 'sd_dev_project'), 'target': make_id(claude_stem, 'shopify_functions'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': claude_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(claude_stem, 'shopify_functions'), 'target': make_id(claude_stem, 'capped_order_discount'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': claude_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(claude_stem, 'shopify_functions'), 'target': make_id(claude_stem, 'free_gift_discount'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': claude_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(claude_stem, 'sd_dev_project'), 'target': make_id(claude_stem, 'discount_wizard'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': claude_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(claude_stem, 'sd_dev_project'), 'target': make_id(claude_stem, 'discount_sync'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': claude_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(claude_stem, 'sd_dev_project'), 'target': make_id(claude_stem, 'billing_plans'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': claude_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(claude_stem, 'sd_dev_project'), 'target': make_id(claude_stem, 'analytics'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': claude_path, 'source_location': None, 'weight': 1.0},
    {'source': make_id(claude_stem, 'sd_dev_project'), 'target': make_id(claude_stem, 'graphify_integration'), 'relation': 'references', 'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': claude_path, 'source_location': None, 'weight': 1.0},
]

claude_hyperedges = [
    {'id': make_id(claude_stem, 'project_architecture'), 'label': 'Project Architecture Overview', 'nodes': [make_id(claude_stem, 'sd_dev_project'), make_id(claude_stem, 'shopify_discount_app'), make_id(claude_stem, 'react_router_vite_tailwind'), make_id(claude_stem, 'prisma_database'), make_id(claude_stem, 'shopify_functions')], 'relation': 'form', 'confidence': 'EXTRACTED', 'confidence_score': 0.75, 'source_file': claude_path},
]

# Combine for chunk 2
chunk2 = {
    'nodes': changelog_nodes + claude_nodes,
    'edges': changelog_edges + claude_edges,
    'hyperedges': changelog_hyperedges + claude_hyperedges,
    'input_tokens': 0,
    'output_tokens': 0,
}

Path('graphify-out/.graphify_chunk_02.json').write_text(json.dumps(chunk2, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Chunk 2: {len(chunk2["nodes"])} nodes, {len(chunk2["edges"])} edges, {len(chunk2["hyperedges"])} hyperedges')