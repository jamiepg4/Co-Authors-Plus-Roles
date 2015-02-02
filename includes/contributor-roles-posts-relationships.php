<?php
/**
 * Functions that create or esatblish a relationship between a co-author and a post.
 *
 */

namespace CoAuthorsPlusRoles;


/**
 * Sets a guest author as a contributor on a post, with a specified role.
 *
 * This should be called on all additional contributors, not on primary
 * authors/bylines, who will use the existing functionality from Co-Authors Plus.
 *
 * @param int|object $post_id Post to set author as "coauthor" on
 * @param object|string $author WP_User object, or nicename/user_login/slug
 * @param object|string $contributor_role Term or slug of contributor role to set. Defaults to "byline" if empty
 * @return bool True on success, false on failure (if any of the inputs are not acceptable).
 */
function set_contributor_on_post( $post_id, $author, $contributor_role = false ) {
	global $coauthors_plus, $wpdb;

	if ( is_object( $post_id ) && isset( $post_id->ID ) )
		$post_id = $post_id->ID;

	$post_id = intval( $post_id );

	if ( is_string( $author ) )
		$author = $coauthors_plus->get_coauthor_by( 'user_nicename', $author );

	if ( is_int( $author ) )
		$author = $coauthors_plus->get_coauthor_by( 'id', $author );

	// Only create the byline term if the contributor role is:
	//  - one of the byline roles, as set in register_contributor_role(), or
	//  - unset, meaning they should default to primary author role.
	if ( ! $contributor_role || in_array( $contributor_role, byline_roles() ) )
		$coauthors_plus->add_coauthors( $post_id, array( $author->user_login ), true );

	if ( ! $post_id || ! $author )
		return false;

	$drop_existing_role = $wpdb->query(
		$wpdb->prepare(
			"DELETE FROM {$wpdb->postmeta} WHERE post_id=%d AND meta_key LIKE 'cap-%' AND meta_value=%d",
			array( $post_id, $author->ID )
		)
	);

	if ( ! $contributor_role )
		return true;

	if ( is_string( $contributor_role ) )
		$contributor_role = get_contributor_role( $contributor_role );

		update_post_meta( $post_id, 'cap-' . $contributor_role->slug, $author->ID );
}


/**
 * Removes a guest author from a post.
 *
 * @param int|object $post_id Post to set author as "coauthor" on
 * @param object|string $author WP_User object, or nicename/user_login/slug
 * @param object|string $contributor_role Term or slug of contributor role to set. Defaults to "byline" if empty
 * @return bool True on success, false on failure (if any of the inputs are not acceptable).
 */
function remove_contributor_from_post( $post_id, $author, $contributor_role = false ) {
	global $coauthors_plus, $wpdb;

	if ( is_object( $post_id ) && isset( $post_id->ID ) )
		$post_id = $post_id->ID;

	$post_id = intval( $post_id );

	if ( is_string( $author ) )
		$author = $coauthors_plus->get_coauthor_by( 'user_nicename', $author );

	if ( is_int( $author ) )
		$author = $coauthors_plus->get_coauthor_by( 'id', $author );

	// Remove byline term from post
	$post_coauthors = $coauthors_plus->get_coauthors( $post_id, array( 'role' => 'any' ) );

	wp_set_object_terms( $post_id, 'cap-' . $author->user_nicename, $coauthors_plus->coauthor_taxonomy, true );

	if ( $contributor_role ) {
		$drop_existing_role = $wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->postmeta} WHERE post_id=%d AND meta_key LIKE 'cap-%' AND meta_value=%d",
				array( $post_id, $author->ID )
			)
		);
	}

}

