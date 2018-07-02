#! /usr/bin/perl -w

#
## @author: Shadow Caster
## @date: Tuesday 10 Feb 2009
## @version 0.0
## @license: Apache 2.0
##
## This script counts the number of verses in each chapter and saves the results 
## to a CSV file
#

open(CSVHANDLE, ">./c/numberofverses.csv") or die("Couldn't open CSV file");

#loop through all the surahs
for($i = 1; $i < 115; $i++){
	open(HANDLE, "./c/$i.txt") or die("Couldn't open in file");
	$count = 0;
	while(<HANDLE>){
		$count++;
	}
	print CSVHANDLE "$i, $count \n";
	close(HANDLE);
}

close(CSVHANDLE); 
print "All Done! \n";
